/**
 * A Chainlink feed's past answers, for price history.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import { type Address, parseAbi } from "viem"
import type { ChainClient } from "../ChainClient.ts"

const proxyAbi = parseAbi([
  "function getRoundData(uint80 roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function latestRound() view returns (uint256)"
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

// A proxy round id is the phase (one per aggregator the feed has used) in the top 16 bits, that aggregator's own
// round in the low 64.
const PHASE_SHIFT = BigInt(64)
const AGGREGATOR_MASK = (BigInt(1) << PHASE_SHIFT) - BigInt(1)

/**
 * Each phase of a feed with its last round, newest phase first, so history can be walked across aggregator upgrades.
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const readPhases = (chain: ChainClient["Service"], feed: Address) =>
  chain.use("read phases", async (client) => {
    const latest = await client.readContract({ address: feed, abi: proxyAbi, functionName: "latestRound" })
    const current = Number(latest >> PHASE_SHIFT)
    const phases = [{ phase: current, lastRound: latest & AGGREGATOR_MASK }]
    // Older aggregators only answer through the proxy, so find each one's last round by searching proxy reads.
    const exists = (phase: number, round: bigint) =>
      client.readContract({
        address: feed,
        abi: proxyAbi,
        functionName: "getRoundData",
        args: [(BigInt(phase) << PHASE_SHIFT) | round]
      }).then((data) => data[3] > BigInt(0), () => false)
    for (let phase = current - 1; phase >= 1; phase--) {
      if (!(await exists(phase, BigInt(1)))) continue
      let low = BigInt(1)
      let high = BigInt(2)
      while (await exists(phase, high)) [low, high] = [high, high * BigInt(2)]
      while (high - low > BigInt(1)) {
        const middle = (low + high) / BigInt(2)
        if (await exists(phase, middle)) low = middle
        else high = middle
      }
      phases.push({ phase, lastRound: low })
    }
    return phases
  }).pipe(Effect.withSpan("chain.readPhases"))

/**
 * Up to `count` rounds of a phase at or below `fromRound` (newest first), in one multicall.
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const readRounds = (
  chain: ChainClient["Service"],
  feed: Address,
  input: { readonly phase: number; readonly fromRound: bigint; readonly count: number }
) =>
  chain.use("read rounds", async (client) => {
    const ids = Array.from({ length: input.count }, (_, index) => input.fromRound - BigInt(index))
      .filter((id) => id > BigInt(0))
      .map((id) => (BigInt(input.phase) << PHASE_SHIFT) | id)
    const results = await client.multicall({
      contracts: ids.map((roundId) => ({
        address: feed,
        abi: proxyAbi,
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
  }).pipe(Effect.withSpan("chain.readRounds"))
