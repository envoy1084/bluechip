import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { factory, factoryAbi } from "@bluechip/chain/market/Aerodrome"
import { readPrices } from "@bluechip/chain/market/Prices"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { fillOf, swapCallGas, swapCalls } from "@bluechip/chain/market/Swaps"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createTestClient, createWalletClient, http, parseEther } from "viem"
import { base } from "viem/chains"
import { forkAvailable, ForkChainClient, forkUrl } from "../support/fork.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

describe.skipIf(!forkAvailable)("market on the local fork", () => {
  layer(Layer.provideMerge(DevChain.layer, ForkChainClient))((it) => {
    it.effect("every pinned pool is the factory's USDC pool for that stock", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const tradable = stocks.filter((stock) => stock.pool !== null)
        const found = yield* chain.use("getPool", (client) =>
          Promise.all(tradable.map((stock) =>
            client.readContract({
              address: factory,
              abi: factoryAbi,
              functionName: "getPool",
              args: [usdc, stock.token, stock.pool!.tickSpacing]
            })
          )))
        assert.deepStrictEqual(
          found.map((pool) => pool.toLowerCase()),
          tradable.map((stock) => stock.pool!.address.toLowerCase())
        )
      }))

    it.effect("reads every stock's reference price with the chain's time", () =>
      Effect.gen(function*() {
        const { asOf, prices } = yield* readPrices(yield* ChainClient)
        assert.strictEqual(prices.length, stocks.length)
        for (const price of prices) assert.isTrue(price.updatedAt.getTime() <= asOf.getTime(), price.stock.symbol)
      }))

    it.effect("a quote is what the swap's calls actually fill", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const dev = yield* DevChain
        const trader = "0x00000000000000000000000000000000000be1a5" as const
        const amountIn = BigInt(250_000_000)
        yield* dev.setEthBalance(trader, parseEther("1"))
        yield* dev.setUsdcBalance(trader, amountIn)

        const quoted = yield* quoteExactIn(chain, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })
        const swap = {
          stock: nvda,
          side: "buy",
          amountIn,
          minimumOut: BigInt(0),
          recipient: trader,
          deadline: BigInt(2) ** BigInt(64)
        } as const

        const logs = yield* chain.use("swap", async (client) => {
          const anvil = createTestClient({ chain: base, mode: "anvil", transport: http(forkUrl) })
          const wallet = createWalletClient({ chain: base, account: trader, transport: http(forkUrl) })
          await anvil.impersonateAccount({ address: trader })
          const found = []
          for (const call of swapCalls(swap)) {
            const hash = await wallet.sendTransaction({ to: call.to, data: call.data, gas: swapCallGas })
            found.push(...(await client.waitForTransactionReceipt({ hash })).logs)
          }
          return found
        })

        const fill = fillOf(logs, swap, trader)
        assert.isDefined(fill)
        assert.strictEqual(fill!.amountIn, amountIn)
        // Within 1 basis point: the quote simulates the same pool state the swap meets.
        const gap = quoted > fill!.amountOut ? quoted - fill!.amountOut : fill!.amountOut - quoted
        assert.isTrue(gap * BigInt(10_000) <= quoted, `quoted ${quoted}, filled ${fill!.amountOut}`)
      }))
  })
})
