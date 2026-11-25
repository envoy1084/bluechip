import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { factory, factoryAbi, swapRouter, swapRouterAbi } from "@bluechip/chain/market/Aerodrome"
import { readPrices } from "@bluechip/chain/market/Prices"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { readPhases, readRounds } from "@bluechip/chain/market/Rounds"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createTestClient, createWalletClient, erc20Abi, http, parseEther } from "viem"
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

    it.effect("walks a feed's past answers, newest first", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const [current] = yield* readPhases(chain, nvda.feed)
        const rounds = yield* readRounds(chain, nvda.feed, {
          phase: current!.phase,
          fromRound: current!.lastRound,
          count: 5
        })
        assert.isAbove(rounds.length, 0)
        for (let index = 1; index < rounds.length; index++) {
          assert.isTrue(rounds[index]!.updatedAt <= rounds[index - 1]!.updatedAt)
        }
      }))

    it.effect("a quote is what the swap actually returns", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const dev = yield* DevChain
        const trader = "0x00000000000000000000000000000000000be1a5" as const
        const amountIn = BigInt(250_000_000)
        yield* dev.setEthBalance(trader, parseEther("1"))
        yield* dev.setUsdcBalance(trader, amountIn)
        const quoted = yield* quoteExactIn(chain, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })
        const received = yield* chain.use("swap", async (client) => {
          const anvil = createTestClient({ chain: base, mode: "anvil", transport: http(forkUrl) })
          const wallet = createWalletClient({ chain: base, account: trader, transport: http(forkUrl) })
          await anvil.impersonateAccount({ address: trader })
          const before = await client.readContract({
            address: nvda.token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [trader]
          })
          await client.waitForTransactionReceipt({
            hash: await wallet.writeContract({
              address: usdc,
              abi: erc20Abi,
              functionName: "approve",
              args: [swapRouter, amountIn]
            })
          })
          await client.waitForTransactionReceipt({
            hash: await wallet.writeContract({
              address: swapRouter,
              abi: swapRouterAbi,
              functionName: "exactInputSingle",
              // The fork's gas estimate undercounts the B20 precompiles (the swap uses ~376k; the estimate runs out).
              gas: BigInt(1_000_000),
              args: [{
                tokenIn: usdc,
                tokenOut: nvda.token,
                tickSpacing: nvda.pool!.tickSpacing,
                recipient: trader,
                deadline: BigInt(2) ** BigInt(64),
                amountIn,
                amountOutMinimum: BigInt(0),
                sqrtPriceLimitX96: BigInt(0)
              }]
            })
          })
          const after = await client.readContract({
            address: nvda.token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [trader]
          })
          return after - before
        })
        // Within 1 basis point: the quote simulates the same pool state the swap meets.
        const gap = quoted > received ? quoted - received : received - quoted
        assert.isTrue(gap * BigInt(10_000) <= quoted, `quoted ${quoted}, received ${received}`)
      }))
  })
})
