/**
 * A Chainlink feed's past answers, for price history.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import { parseAbi } from "viem"
import type { ChainClient } from "../ChainClient.ts"

const roundsAbi = parseAbi([
  "function getRoundData(uint80 roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
])

/**
 * One past answer of a feed.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Round {
  readonly roundId: bigint
  readonly price: bigint
  readonly updatedAt: Date
}

// A proxy round id is the phase in the top 16 bits and the aggregator's round in the low 64.
const PHASE_SHIFT = BigInt(64)
const AGGREGATOR_MASK = (BigInt(1) << PHASE_SHIFT) - BigInt(1)

/**
 * Up to `count` rounds before `latestRoundId` (newest first), in one multicall. Walks within the latest round's
 * phase only: earlier phases are other aggregators, and these feeds started in their current phase.
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const readRoundsBefore = (
  chain: ChainClient["Service"],
  feed: `0x${string}`,
  latestRoundId: bigint,
  count: number
) =>
  chain.use("read rounds", async (client) => {
    const phase = latestRoundId >> PHASE_SHIFT
    const aggregatorRound = latestRoundId & AGGREGATOR_MASK
    const ids = Array.from({ length: count }, (_, index) => aggregatorRound - BigInt(index + 1))
      .filter((id) => id > BigInt(0))
      .map((id) => (phase << PHASE_SHIFT) | id)
    const results = await client.multicall({
      contracts: ids.map((roundId) => ({
        address: feed,
        abi: roundsAbi,
        functionName: "getRoundData" as const,
        args: [roundId]
      })),
      allowFailure: true
    })
    return results.flatMap((result, index): Array<Round> =>
      result.status === "success" && result.result[1] > BigInt(0) && result.result[3] > BigInt(0)
        ? [{ roundId: ids[index]!, price: result.result[1], updatedAt: new Date(Number(result.result[3]) * 1000) }]
        : []
    )
  }).pipe(Effect.withSpan("chain.readRoundsBefore"))
