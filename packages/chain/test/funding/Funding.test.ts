import { ChainClient } from "@bluechip/chain/ChainClient"
import { DevChain } from "@bluechip/chain/DevChain"
import { assetTokens, readBalances } from "@bluechip/chain/funding/Balances"
import { multiplierScale, readMultipliers } from "@bluechip/chain/market/Multipliers"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"
import { forkAvailable, ForkChainClient } from "../support/fork.ts"

describe.skipIf(!forkAvailable)("funding on the local fork", () => {
  layer(Layer.provideMerge(DevChain.layer, ForkChainClient))((it) => {
    it.effect("reads every account's balances at one block", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const dev = yield* DevChain
        const alice = privateKeyToAddress(generatePrivateKey())
        const bob = privateKeyToAddress(generatePrivateKey())

        const before = yield* readBalances(chain, [alice, bob])
        yield* dev.sendUsdc(alice, BigInt(3_000_000))
        yield* dev.sendUsdc(bob, BigInt(1_000_000))
        const after = yield* readBalances(chain, [alice, bob])

        assert.isTrue(after.blockNumber > before.blockNumber)
        assert.strictEqual(after.balances.get(alice)!.length, assetTokens.length)
        assert.strictEqual(after.balances.get(alice)![0], BigInt(3_000_000))
        assert.strictEqual(after.balances.get(bob)![0], BigInt(1_000_000))
      }))

    it.effect("reads every stock token's multiplier", () =>
      Effect.gen(function*() {
        const multipliers = yield* readMultipliers(yield* ChainClient)

        assert.strictEqual(multipliers.size, 13)
        // Around one share per token; splits move it in whole steps (SNDK's is 8).
        for (const multiplier of multipliers.values()) assert.isTrue(multiplier >= multiplierScale / BigInt(100))
      }))
  })
})
