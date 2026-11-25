import { aggregatorAbi, b20Abi } from "@bluechip/chain/Abis"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { erc20Abi } from "viem"
import { forkAvailable, ForkChainClient } from "./fork.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

describe.skipIf(!forkAvailable)("on the local fork", () => {
  layer(Layer.provideMerge(DevChain.layer, ForkChainClient))((it) => {
    it.effect("reads a stock token and its price feed", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const [decimals, multiplier, round] = yield* chain.use("read NVDA", (client) =>
          Promise.all([
            client.readContract({ address: nvda.token, abi: erc20Abi, functionName: "decimals" }),
            client.readContract({ address: nvda.token, abi: b20Abi, functionName: "multiplier" }),
            client.readContract({ address: nvda.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
          ]))
        assert.strictEqual(decimals, 8)
        assert.isTrue(multiplier >= 10n ** 18n)
        assert.isTrue(round[1] > 0n)
      }))

    it.effect("gives an account USDC", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const dev = yield* DevChain
        const account = "0x00000000000000000000000000000000b1c4f00d"
        yield* dev.setUsdcBalance(account, 1_234_000_000n)
        const balance = yield* chain.use("read USDC", (client) =>
          client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] }))
        assert.strictEqual(balance, 1_234_000_000n)
      }))
  })
})
