import { ChainClient } from "@bluechip/chain/ChainClient"
import { DevChain } from "@bluechip/chain/DevChain"
import { readBalances } from "@bluechip/chain/funding/Balances"
import { readMultipliers } from "@bluechip/chain/market/Multipliers"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"

const zero = BigInt(0)

layer(DevnetTest.layer)("readBalances", (it) => {
  it.effect("each account's USDC and stocks, in the order of assets", () =>
    Effect.gen(function*() {
      const alice = privateKeyToAddress(generatePrivateKey())
      const bob = privateKeyToAddress(generatePrivateKey())
      yield* (yield* DevChain).setUsdcBalance(alice, BigInt(3_000_000))
      yield* (yield* Devnet).mintShares(alice, "NVDA", BigInt(150_000_000))
      yield* (yield* DevChain).setUsdcBalance(bob, BigInt(1_000_000))

      const { balances } = yield* readBalances(yield* ChainClient, [alice, bob])

      // USDC, then AAPL, AMZN, ANT, CRCL, GOOGL, INTC, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA.
      assert.deepStrictEqual(balances.get(alice), [
        BigInt(3_000_000),
        zero,
        zero,
        zero,
        zero,
        zero,
        zero,
        zero,
        zero,
        zero,
        BigInt(150_000_000),
        zero,
        zero,
        zero
      ])
      assert.deepStrictEqual(balances.get(bob), [BigInt(1_000_000), ...Array.from({ length: 13 }, () => zero)])
    }))

  it.effect("an account that holds nothing", () =>
    Effect.gen(function*() {
      const nobody = privateKeyToAddress(generatePrivateKey())

      const { balances } = yield* readBalances(yield* ChainClient, [nobody])

      assert.deepStrictEqual(balances.get(nobody), Array.from({ length: 14 }, () => zero))
    }))

  it.effect("balances are read at one block, the latest", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const latest = yield* chain.use("getBlockNumber", (client) => client.getBlockNumber())

      const { blockNumber } = yield* readBalances(chain, [privateKeyToAddress(generatePrivateKey())])

      assert.strictEqual(blockNumber, latest)
    }))
})

layer(DevnetTest.layer)("readMultipliers", (it) => {
  it.effect("every stock token's multiplier, by symbol", () =>
    Effect.gen(function*() {
      const multipliers = yield* readMultipliers(yield* ChainClient)

      assert.strictEqual(multipliers.size, 13)
      // NVDA's, as on Base at the devnet's block: 1.000537939576369481 shares per token.
      assert.strictEqual(multipliers.get("NVDA"), BigInt("1000537939576369481"))
    }))
})
