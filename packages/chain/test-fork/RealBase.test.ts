// The facts the devnet copies from Base, checked against a fork of Base (`pnpm dev` or `docker compose --profile
// chain up -d` runs it). Run with `pnpm test:fork`; not part of `pnpm check`.
import { aggregatorAbi, b20Abi } from "@bluechip/chain/Abis"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { baseDeployment } from "@bluechip/chain/deployments/Base"
import { factoryAbi } from "@bluechip/chain/market/Aerodrome"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { erc20Abi } from "viem"

const { stocks, usdc } = baseDeployment

// The fork fetches each contract from Base on its first read; fetching them all once as the layer builds keeps each
// check below to local reads.
const ForkChainClient = Layer.effect(
  ChainClient,
  Effect.gen(function*() {
    const chain = ChainClient.make("local", "http://localhost:8545")
    yield* chain.use("fetch contracts", (client) =>
      Promise.all(stocks.flatMap((stock) => [
        client.readContract({ address: stock.token, abi: erc20Abi, functionName: "symbol" }),
        client.readContract({ address: stock.feed, abi: aggregatorAbi, functionName: "description" })
      ])))
    return chain
  })
)

layer(ForkChainClient, { timeout: "60 seconds" })("Base", (it) => {
  it.effect("every stock token is the Coinbase stock its feed prices, with 8 decimals", () =>
    Effect.gen(function*() {
      const reads = yield* (yield* ChainClient).use("read stocks", (client) =>
        Promise.all(stocks.map((stock) =>
          Promise.all([
            client.readContract({ address: stock.token, abi: erc20Abi, functionName: "symbol" }),
            client.readContract({ address: stock.token, abi: erc20Abi, functionName: "decimals" }),
            client.readContract({ address: stock.feed, abi: aggregatorAbi, functionName: "description" })
          ])
        )))

      assert.deepStrictEqual(
        reads.map(([symbol, decimals, description]) => [symbol, decimals, description.split(" ")[1]]),
        stocks.map((stock) => [`${stock.symbol}c`, 8, stock.symbol])
      )
    }))

  it.effect("every stock token has a multiplier of about one share or more", () =>
    Effect.gen(function*() {
      const multipliers = yield* (yield* ChainClient).use("read multipliers", (client) =>
        Promise.all(stocks.map((stock) =>
          client.readContract({ address: stock.token, abi: b20Abi, functionName: "multiplier" })
        )))

      for (const [index, multiplier] of multipliers.entries()) {
        assert.isTrue(multiplier >= BigInt(10) ** BigInt(18), stocks[index]!.symbol)
      }
    }))

  it.effect("every pinned pool is the factory's USDC pool for its stock", () =>
    Effect.gen(function*() {
      const tradable = stocks.filter((stock) => stock.pool !== null)
      const found = yield* (yield* ChainClient).use("getPool", (client) =>
        Promise.all(tradable.map((stock) =>
          client.readContract({
            address: baseDeployment.exchange.factory,
            abi: factoryAbi,
            functionName: "getPool",
            args: [usdc, stock.token, stock.pool!.tickSpacing]
          })
        )))

      assert.deepStrictEqual(
        found.map((pool) =>
          pool.toLowerCase()
        ),
        tradable.map((stock) => stock.pool!.address.toLowerCase())
      )
    }))
})
