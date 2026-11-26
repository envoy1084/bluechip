import { addOwnerCall, credentialIdOf, ownersOf, removeOwnerCall } from "@bluechip/chain/account/Owners"
import { ChainClient } from "@bluechip/chain/ChainClient"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { softwarePasskey } from "@bluechip/devnet/Passkeys"
import { assert, layer } from "@effect/vitest"
import { KernelAccount } from "@namera-ai/sdk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { hexToBigInt } from "viem"
import { TestAgents } from "../../utils/TestAgents.ts"

layer(Layer.provideMerge(TestAgents.layer, DevnetTest.layer))("the account's passkey owners", (it) => {
  it.effect("the sign-up passkey is the one owner, any one of one signs", () =>
    Effect.gen(function*() {
      const { address, owner } = yield* (yield* TestAgents).lock()

      const owners = yield* ownersOf(address)

      assert.deepStrictEqual(owners, { threshold: 1, credentialIds: [credentialIdOf(owner.publicKey)] })
    }))

  it.effect("a second passkey added in one operation signs on its own", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { address, owner, send, sendAs } = yield* (yield* TestAgents).lock()
      const second = softwarePasskey()

      const added = yield* send([addOwnerCall(second.publicKey)])
      const asSecond = yield* chain.use("KernelAccount.from", (client) =>
        KernelAccount.from({ client, owner: second, address }))
      const removed = yield* sendAs(asSecond, [removeOwnerCall(owner.publicKey)])

      assert.isTrue(added.success)
      assert.isTrue(removed.success)
      assert.deepStrictEqual(yield* ownersOf(address), {
        threshold: 1,
        credentialIds: [credentialIdOf(second.publicKey)]
      })
    }))

  it.effect("two owners are listed by credential id", () =>
    Effect.gen(function*() {
      const { address, owner, send } = yield* (yield* TestAgents).lock()
      const second = softwarePasskey()

      yield* send([addOwnerCall(second.publicKey)])

      const ids = [credentialIdOf(owner.publicKey), credentialIdOf(second.publicKey)]
        .sort((a, b) => hexToBigInt(a) < hexToBigInt(b) ? -1 : 1)
      assert.deepStrictEqual(yield* ownersOf(address), { threshold: 1, credentialIds: ids })
    }))

  it.effect("the last owner can't be removed", () =>
    Effect.gen(function*() {
      const { address, owner, send } = yield* (yield* TestAgents).lock()

      const removed = yield* Effect.result(send([removeOwnerCall(owner.publicKey)]))

      assert.isTrue(removed._tag === "Failure" || !removed.success.success)
      assert.deepStrictEqual(yield* ownersOf(address), {
        threshold: 1,
        credentialIds: [credentialIdOf(owner.publicKey)]
      })
    }))

  it.effect("a removed passkey signs no more", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { account, address, owner, send, sendAs } = yield* (yield* TestAgents).lock()
      const second = softwarePasskey()
      yield* send([addOwnerCall(second.publicKey)])
      const asSecond = yield* chain.use("KernelAccount.from", (client) =>
        KernelAccount.from({ client, owner: second, address }))
      yield* sendAs(asSecond, [removeOwnerCall(owner.publicKey)])

      const again = yield* Effect.result(sendAs(account, [addOwnerCall(softwarePasskey().publicKey)]))

      assert.strictEqual(again._tag, "Failure")
    }))
})
