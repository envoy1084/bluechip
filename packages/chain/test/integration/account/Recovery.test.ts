import { credentialIdOf, ownersOf } from "@bluechip/chain/account/Owners"
import {
  cancelCall,
  guardSession,
  RECOVERY_DELAY_SECONDS,
  recoveryCalls,
  recoverySession,
  requestCall,
  requestedAt,
  setupCalls
} from "@bluechip/chain/account/Recovery"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { lockedGrant } from "@bluechip/chain/policies/Session"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { softwarePasskey } from "@bluechip/devnet/Passkeys"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { UserOperation } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { TestAgents } from "../../utils/TestAgents.ts"

// What the recovery key signs for a due change: gas set by hand, since the bundler won't estimate an operation that
// isn't valid yet by its clock.
const GAS = {
  callGasLimit: BigInt(400_000),
  verificationGasLimit: BigInt(3_000_000),
  preVerificationGas: BigInt(200_000),
  ...BASE_FEES
}

layer(Layer.provideMerge(TestAgents.layer, DevnetTest.layer))("recovery with a recovery passkey", (it) => {
  // A passkey-owned account with a recovery key and a guard set up, and a recovery to a new passkey.
  const setUp = Effect.gen(function*() {
    const agents = yield* TestAgents
    const devnet = yield* Devnet
    const chain = yield* ChainClient
    const agent = yield* agents.lock()
    const recoveryKey = softwarePasskey()
    const guardKey = privateKeyToAccount(generatePrivateKey())
    const newOwner = softwarePasskey()

    const recovery = recoverySession({ publicKey: recoveryKey.publicKey, id: "recovery_test" })
    const guard = guardSession({ signer: guardKey.address, id: "recovery_test" })
    const setup = yield* agent.send(setupCalls(recovery, guard))
    const asRecovery = yield* agents.sessionFor(yield* lockedGrant(agent.account, recovery), recoveryKey)
    const asGuard = yield* agents.sessionFor(yield* lockedGrant(agent.account, guard), guardKey)
    const calls = recoveryCalls({ newOwner: newOwner.publicKey, oldOwners: [agent.owner.publicKey] })

    const send = Effect.fnUntraced(function*(client: typeof asRecovery, toSend: typeof calls) {
      const hash = yield* chain.use("sendUserOperation", () => client.sendUserOperation({ calls: [...toSend] }))
      return yield* chain.use("waitForUserOperationReceipt", () => client.waitForUserOperationReceipt({ hash }))
    })
    // The recovery, signed by the recovery key and sent straight to the EntryPoint.
    const recover = Effect.gen(function*() {
      const operation = (yield* chain.use(
        "prepareUserOperation",
        () => asRecovery.prepareUserOperation({ calls: [...calls], ...GAS })
      )) as UserOperation<"0.7">
      const signature = yield* chain.use("signUserOperation", () => asRecovery.account.signUserOperation(operation))
      return yield* devnet.handleOps([{ ...operation, signature }])
    })

    return { agent, setup, calls, newOwner, asRecovery, asGuard, send, recover, devnet }
  })

  it.effect("set up in one owner operation", () =>
    Effect.gen(function*() {
      const { setup } = yield* setUp

      assert.isTrue(setup.success)
    }))

  it.effect("the recovery key's request is recorded onchain", () =>
    Effect.gen(function*() {
      const { agent, asRecovery, calls, send } = yield* setUp

      const requested = yield* send(asRecovery, [requestCall(calls)])
      const at = yield* requestedAt(agent.address, calls[0]!)

      assert.isTrue(requested.success)
      assert.isNumber(at)
    }))

  it.effect("before 48 hours the EntryPoint refuses the recovery", () =>
    Effect.gen(function*() {
      const { agent, asRecovery, calls, devnet, recover, send } = yield* setUp
      yield* send(asRecovery, [requestCall(calls)])

      const early = yield* devnet.inFuture(RECOVERY_DELAY_SECONDS - 600, recover)

      assert.isFalse(early)
      assert.deepStrictEqual((yield* ownersOf(agent.address)).credentialIds, [credentialIdOf(agent.owner.publicKey)])
    }))

  it.effect("the bundler refuses a recovery that isn't due yet", () =>
    Effect.gen(function*() {
      const { asRecovery, calls, send } = yield* setUp
      yield* send(asRecovery, [requestCall(calls)])

      const sent = yield* Effect.result(send(asRecovery, calls))

      assert.strictEqual(sent._tag, "Failure")
    }))

  it.effect("after 48 hours the new passkey replaces the old owner", () =>
    Effect.gen(function*() {
      const { agent, asRecovery, calls, devnet, newOwner, recover, send } = yield* setUp
      yield* send(asRecovery, [requestCall(calls)])

      const owners = yield* devnet.inFuture(
        RECOVERY_DELAY_SECONDS + 60,
        Effect.andThen(recover, (landed) => Effect.map(ownersOf(agent.address), (owners) => ({ landed, owners })))
      )

      assert.deepStrictEqual(owners, {
        landed: true,
        owners: { threshold: 1, credentialIds: [credentialIdOf(newOwner.publicKey)] }
      })
    }))

  it.effect("a recovery nobody asked for is refused, even after 48 hours", () =>
    Effect.gen(function*() {
      const { devnet, recover } = yield* setUp

      const landed = yield* devnet.inFuture(RECOVERY_DELAY_SECONDS + 60, recover)

      assert.isFalse(landed)
    }))

  it.effect("the guard's cancel stops the recovery for good", () =>
    Effect.gen(function*() {
      const { agent, asGuard, asRecovery, calls, devnet, recover, send } = yield* setUp
      yield* send(asRecovery, [requestCall(calls)])

      const cancelled = yield* send(asGuard, [cancelCall(calls)])
      const landed = yield* devnet.inFuture(RECOVERY_DELAY_SECONDS + 60, recover)

      assert.isTrue(cancelled.success)
      assert.isUndefined(yield* requestedAt(agent.address, calls[0]!))
      assert.isFalse(landed)
    }))

  it.effect("an owner's cancel stops the recovery", () =>
    Effect.gen(function*() {
      const { agent, asRecovery, calls, send } = yield* setUp
      yield* send(asRecovery, [requestCall(calls)])

      const cancelled = yield* agent.send([cancelCall(calls)])

      assert.isTrue(cancelled.success)
      assert.isUndefined(yield* requestedAt(agent.address, calls[0]!))
    }))

  it.effect("the guard can't ask for a recovery", () =>
    Effect.gen(function*() {
      const { asGuard, calls, send } = yield* setUp

      const asked = yield* Effect.result(send(asGuard, [requestCall(calls)]))

      assert.strictEqual(asked._tag, "Failure")
    }))
})
