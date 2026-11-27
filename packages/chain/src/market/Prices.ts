/**
 * Reference prices from the stocks' Chainlink feeds.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import { aggregatorAbi } from "../Abis.ts"
import type { ChainClient } from "../ChainClient.ts"
import type { Stock } from "../Deployment.ts"

/**
 * A feed's latest answer: USD × 1e8 per share-token, already adjusted for the token's multiplier.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface FeedPrice {
  readonly stock: Stock
  readonly price: bigint
  readonly updatedAt: Date
  readonly roundId: bigint
}

/**
 * Every stock's latest feed answer in one multicall, with the block's timestamp: the chain's own "now", which keeps
 * a fork consistent with the prices it has. A feed that can't be read is left out.
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const readPrices = (chain: ChainClient["Service"]) =>
  chain.use("read prices", async (client) => {
    const { stocks } = chain.deployment
    const [block, results] = await Promise.all([
      client.getBlock({ blockTag: "latest" }),
      client.multicall({
        contracts: stocks.map((stock) => ({
          address: stock.feed,
          abi: aggregatorAbi,
          functionName: "latestRoundData" as const
        })),
        allowFailure: true
      })
    ])
    const prices = results.flatMap((result, index): Array<FeedPrice> =>
      result.status === "success" && result.result[1] > BigInt(0)
        ? [{
          stock: stocks[index]!,
          price: result.result[1],
          updatedAt: new Date(Number(result.result[3]) * 1000),
          roundId: result.result[0]
        }]
        : []
    )
    return { asOf: new Date(Number(block.timestamp) * 1000), prices }
  }).pipe(Effect.withSpan("chain.readPrices"))
