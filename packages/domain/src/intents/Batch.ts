/**
 * A plan of several trades sent as few operations as its agent's policies allow: one operation (a wave) carries at
 * most one leg per stock, since the agent's onchain rules judge each stock's net move in an operation, and two pieces
 * of one split trade would net past its largest trade.
 *
 * @since 0.0.0
 */
import type { Leg } from "./Intent.ts"

/**
 * `legs` in waves, one operation each, in order: each leg joins the first wave without its stock, and each wave lists
 * its sells before its buys, so their cash is there for the buys. Grouping a wave's legs again gives the same waves.
 *
 * **Example** (A rebalance split through a largest trade)
 *
 * ```ts import.meta.vitest
 * import { waves } from "@bluechip/domain/intents/Batch"
 *
 * const leg = (symbol: string, side: "buy" | "sell") => ({ symbol, side, amount: { usdc: 1n } }) as never
 * waves([leg("AAPL", "buy"), leg("AAPL", "buy"), leg("NVDA", "sell")]).map((wave) => wave.length)
 * // => [2, 1]
 * ```
 *
 * @stability unstable
 * @category planning
 * @since 0.0.0
 */
export const waves = (legs: ReadonlyArray<Leg>): ReadonlyArray<ReadonlyArray<Leg>> => {
  const grouped: Array<Array<Leg>> = []
  for (const leg of legs) {
    const wave = grouped.find((candidate) => !candidate.some((other) => other.symbol === leg.symbol))
    if (wave === undefined) grouped.push([leg])
    else wave.push(leg)
  }
  const side = (wave: ReadonlyArray<Leg>, wanted: Leg["side"]) => wave.filter((leg) => leg.side === wanted)
  return grouped.map((wave) => [...side(wave, "sell"), ...side(wave, "buy")])
}
