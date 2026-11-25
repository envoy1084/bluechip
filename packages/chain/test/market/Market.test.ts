import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { readPrices } from "@bluechip/chain/market/Prices"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { fillOf, type Swap, swapCallGas, swapCalls } from "@bluechip/chain/market/Swaps"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { createTestClient, createWalletClient, http, parseEther } from "viem"
import { base } from "viem/chains"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

layer(DevnetTest.layer)("readPrices", (it) => {
  it.effect("a stock's price and when its feed last updated", () =>
    Effect.gen(function*() {
      yield* (yield* Devnet).setPrice("AAPL", BigInt(27_512_000_000), { ageSeconds: 3600 })

      const { prices } = yield* readPrices(yield* ChainClient)

      const aapl = prices.find((price) => price.stock.symbol === "AAPL")!
      assert.strictEqual(aapl.price, BigInt(27_512_000_000))
      assert.isAtMost(Math.abs(aapl.updatedAt.getTime() - (Date.now() - 3_600_000)), 2000)
    }))

  it.effect("a feed answering zero is left out", () =>
    Effect.gen(function*() {
      yield* (yield* Devnet).setPrice("INTC", BigInt(0))

      const { prices } = yield* readPrices(yield* ChainClient)

      assert.deepStrictEqual(prices.map((price) => price.stock.symbol).includes("INTC"), false)
      assert.strictEqual(prices.length, stocks.length - 1)
    }))
})

layer(DevnetTest.layer)("quoteExactIn", (it) => {
  it.effect("the quote is exactly what the swap's calls then fill", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const dev = yield* DevChain
      const trader = "0x00000000000000000000000000000000000be1a5" as const
      const amountIn = BigInt(250_000_000)
      yield* dev.setEthBalance(trader, parseEther("1"))
      yield* dev.setUsdcBalance(trader, amountIn)

      const quoted = yield* quoteExactIn(chain, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })
      const swap: Swap = {
        stock: nvda,
        side: "buy",
        amountIn,
        minimumOut: BigInt(0),
        recipient: trader,
        deadline: BigInt(2) ** BigInt(64)
      }
      const logs = yield* chain.use("swap", async (client) => {
        const anvil = createTestClient({ chain: base, mode: "anvil", transport: http(chain.rpcUrl) })
        const wallet = createWalletClient({ chain: base, account: trader, transport: http(chain.rpcUrl) })
        await anvil.impersonateAccount({ address: trader })
        const found = []
        for (const call of swapCalls(swap)) {
          const hash = await wallet.sendTransaction({ to: call.to, data: call.data, gas: swapCallGas })
          found.push(...(await client.waitForTransactionReceipt({ hash })).logs)
        }
        return found
      })

      assert.deepStrictEqual(fillOf(logs, swap, trader), { amountIn, amountOut: quoted })
    }))
})
