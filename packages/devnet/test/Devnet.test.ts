import { aggregatorAbi } from "@bluechip/chain/Abis"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { metaquoter, metaquoterAbi } from "@bluechip/chain/market/Aerodrome"
import { Devnet } from "@bluechip/devnet/Devnet"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { erc20Abi } from "viem"
import { DevnetLayer } from "./support/devnet.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

const feedRound = Effect.fnUntraced(function*(feed: `0x${string}`) {
  const chain = yield* ChainClient
  return yield* chain.use(
    "latestRoundData",
    (client) => client.readContract({ address: feed, abi: aggregatorAbi, functionName: "latestRoundData" })
  )
})

layer(DevnetLayer)("Devnet", (it) => {
  describe("installed state", () => {
    it.effect("every stock is a B20 at its real address, with a pool that trades near its feed's price", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient

        for (const stock of stocks) {
          const code = yield* chain.use("getCode", (client) => client.getCode({ address: stock.token }))
          assert.strictEqual(code, "0xef", stock.symbol)

          const [, price] = yield* feedRound(stock.feed)
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

  describe("setPrice", () => {
    it.effect("a price set now reads back as just updated", () =>
      Effect.gen(function*() {
        const devnet = yield* Devnet
        yield* devnet.setPrice("AMZN", BigInt(24_000_000_000))

        const round = yield* feedRound(stocks.find((stock) => stock.symbol === "AMZN")!.feed)
        assert.strictEqual(round[1], BigInt(24_000_000_000))
        assert.isAtMost(Math.abs(Number(round[3]) - Date.now() / 1000), 2)
      }))

    it.effect("a price set a day old reads back a day old", () =>
      Effect.gen(function*() {
        const devnet = yield* Devnet
        yield* devnet.setPrice("MSFT", BigInt(48_000_000_000), { ageSeconds: 86_400 })

        const round = yield* feedRound(stocks.find((stock) => stock.symbol === "MSFT")!.feed)
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
})
