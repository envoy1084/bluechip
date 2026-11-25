import { aggregatorAbi } from "@bluechip/chain/Abis"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { metaquoter, metaquoterAbi } from "@bluechip/chain/market/Aerodrome"
import { swapCallGas, swapCalls } from "@bluechip/chain/market/Swaps"
import { DEVNET_ADMIN } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { createWalletClient, erc20Abi, http } from "viem"
import { base } from "viem/chains"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

layer(DevnetTest.layer)("Devnet", (it) => {
  describe("installed state", () => {
    it.effect("every stock is a B20 at its real address, with a pool that trades near its feed's price", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient

        for (const stock of stocks) {
          const code = yield* chain.use("getCode", (client) => client.getCode({ address: stock.token }))
          assert.strictEqual(code, "0xef", stock.symbol)

          const [, price] = yield* chain.use(
            "latestRoundData",
            (client) =>
              client.readContract({ address: stock.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
          )
          const { result } = yield* chain.use("quote", (client) =>
            client.simulateContract({
              address: metaquoter,
              abi: metaquoterAbi,
              functionName: "quoteExactInputSingleV3",
              args: [stock.pool!.address, usdc, BigInt(100_000_000), BigInt(0)]
            }))
          // $100 at the feed's price, in 8-decimal stock units, against what the pool gives (its 0.05% fee and
          // spread take a little).
          const fair = (BigInt(100) * BigInt(10) ** BigInt(16)) / price
          assert.isTrue(result[0] <= fair && result[0] * BigInt(1000) >= fair * BigInt(995), stock.symbol)
        }
      }))
  })

  describe("Aerodrome's swap hook, as on Base", () => {
    // A $10 buy of NVDA by the admin, approved then swapped, the swap sent with `gas` or at Anvil's estimate.
    it.effect.each([
      { name: "a swap sent at Anvil's gas estimate reverts", gas: undefined, expected: "reverted" },
      { name: "a swap sent with the swap call gas floor fills", gas: swapCallGas, expected: "success" }
    ])("$name", ({ expected, gas }) =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        yield* (yield* DevChain).setUsdcBalance(DEVNET_ADMIN, BigInt(1_000_000_000))
        const wallet = createWalletClient({ chain: base, account: DEVNET_ADMIN, transport: http(chain.rpcUrl) })
        const [approve, swap] = swapCalls({
          stock: nvda,
          side: "buy",
          amountIn: BigInt(10_000_000),
          minimumOut: BigInt(1),
          recipient: DEVNET_ADMIN,
          deadline: BigInt(2) ** BigInt(40)
        })

        const approved = yield* chain.use("approve", () => wallet.sendTransaction({ ...approve! }))
        yield* chain.use("approve receipt", (client) => client.waitForTransactionReceipt({ hash: approved }))
        const swapped = yield* chain.use("swap", () => wallet.sendTransaction({ ...swap!, gas }))
        const receipt = yield* chain.use(
          "swap receipt",
          (client) => client.waitForTransactionReceipt({ hash: swapped })
        )

        assert.strictEqual(receipt.status, expected)
      }))
  })

  describe("setPrice", () => {
    it.effect("a price set now reads back as just updated", () =>
      Effect.gen(function*() {
        const devnet = yield* Devnet
        yield* devnet.setPrice("AMZN", BigInt(24_000_000_000))

        const round = yield* (yield* ChainClient).use("latestRoundData", (client) =>
          client.readContract({
            address: stocks.find((stock) => stock.symbol === "AMZN")!.feed,
            abi: aggregatorAbi,
            functionName: "latestRoundData"
          }))
        assert.strictEqual(round[1], BigInt(24_000_000_000))
        assert.isAtMost(Math.abs(Number(round[3]) - Date.now() / 1000), 2)
      }))

    it.effect("a price set a day old reads back a day old", () =>
      Effect.gen(function*() {
        const devnet = yield* Devnet
        yield* devnet.setPrice("MSFT", BigInt(48_000_000_000), { ageSeconds: 86_400 })

        const round = yield* (yield* ChainClient).use("latestRoundData", (client) =>
          client.readContract({
            address: stocks.find((stock) => stock.symbol === "MSFT")!.feed,
            abi: aggregatorAbi,
            functionName: "latestRoundData"
          }))
        assert.isAtMost(Math.abs(Number(round[3]) - (Date.now() / 1000 - 86_400)), 2)
      }))
  })

  describe("mintShares", () => {
    it.effect("an account receives exactly the shares minted", () =>
      Effect.gen(function*() {
        const devnet = yield* Devnet
        const chain = yield* ChainClient
        const account = "0x00000000000000000000000000000000000a11ce"
        yield* devnet.mintShares(account, "NVDA", BigInt(250_000_000))

        const balance = yield* chain.use("balanceOf", (client) =>
          client.readContract({ address: nvda.token, abi: erc20Abi, functionName: "balanceOf", args: [account] }))
        assert.strictEqual(balance, BigInt(250_000_000))
      }))
  })

  describe("movePool", () => {
    it.effect.each([
      { name: "a pool moved up prices the stock higher", price: BigInt(18_000_000_000) },
      { name: "a pool moved down prices the stock lower", price: BigInt(13_000_000_000) }
    ])("$name", ({ price }) =>
      Effect.gen(function*() {
        yield* (yield* Devnet).movePool("NVDA", price)

        const { result } = yield* (yield* ChainClient).use("quote", (client) =>
          client.simulateContract({
            address: metaquoter,
            abi: metaquoterAbi,
            functionName: "quoteExactInputSingleV3",
            args: [nvda.pool!.address, usdc, BigInt(100_000_000), BigInt(0)]
          }))
        // What $100 buys at the pool's price, in 8-decimal NVDA units, against what $100 buys at `price`.
        const fair = (BigInt(100) * BigInt(10) ** BigInt(16)) / price
        assert.isTrue(result[0] <= fair && result[0] * BigInt(1000) >= fair * BigInt(995))
      }))
  })
})
