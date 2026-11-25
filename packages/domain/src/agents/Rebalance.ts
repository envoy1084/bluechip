/**
 * What "only rebalances" means, after Index Coop's onchain rebalancer: start only when the portfolio is off target,
 * sell only what is overweight and buy only what is underweight, never pass a target, get closer to the mix every
 * time, and keep the portfolio's value. Judged on the net change of all of an operation's trades, since a rebalance
 * sells one stock for USDC and buys another with it.
 *
 * @since 0.0.0
 */
import type { StockSymbol } from "../market/Market.ts"
import { type Limits, OVERSHOOT_BPS, PROGRESS_BPS, rebalanceBand } from "./Limits.ts"
import { drift, type Valuation } from "./TradeMath.ts"

const BPS = BigInt(10_000)

/**
 * A rebalancing rule a trade breaks.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface RebalanceBreach {
  readonly rule: "notNeeded" | "wrongWay" | "overshoots" | "noProgress" | "losesValue"
  readonly asset: StockSymbol | "USDC" | null
}

/**
 * The rebalancing rules `before → after` breaks, for a Rebalancer's `limits`. Both valuations use the same Chainlink
 * prices; `moved` lists the stocks the operation traded.
 *
 * @stability unstable
 * @category rebalancing
 * @since 0.0.0
 */
export const rebalanceBreaches = (options: {
  readonly limits: Limits
  readonly before: Valuation
  readonly after: Valuation
  readonly moved: ReadonlyArray<StockSymbol>
}): ReadonlyArray<RebalanceBreach> => {
  const { after, before, limits } = options
  const breaches: Array<RebalanceBreach> = []
  const target = (asset: StockSymbol | "USDC") =>
    BigInt(limits.targets.find((candidate) => candidate.asset === asset)?.weight ?? 0)

  const driftBefore = drift(before, limits.targets)
  if (driftBefore < rebalanceBand(limits.rebalanceTrigger)) {
    return [{ rule: "notNeeded", asset: null }]
  }

  // Cash only counts as traded when it moved by more than the overshoot tolerance: selling one stock to buy another
  // passes through USDC and may leave a little behind.
  const cashBefore = before.values.get("USDC") ?? BigInt(0)
  const cashAfter = after.values.get("USDC") ?? BigInt(0)
  const cashMove = cashAfter - cashBefore
  const cashMoved = (cashMove < BigInt(0) ? -cashMove : cashMove) * BPS > BigInt(OVERSHOOT_BPS) * before.total
  const assets: ReadonlyArray<StockSymbol | "USDC"> = [...options.moved, ...(cashMoved ? ["USDC" as const] : [])]

  for (const asset of assets) {
    const valueBefore = before.values.get(asset) ?? BigInt(0)
    const valueAfter = after.values.get(asset) ?? BigInt(0)
    if (valueAfter === valueBefore) continue

    const wanted = target(asset)
    const weightBefore = valueBefore * BPS
    const grew = valueAfter > valueBefore

    // A bought asset was under its target; a sold one was over it.
    const underweight = weightBefore < wanted * before.total
    const overweight = weightBefore > wanted * before.total
    if ((grew && !underweight) || (!grew && !overweight)) {
      breaches.push({ rule: "wrongWay", asset })
      continue
    }

    const tolerance = BigInt(OVERSHOOT_BPS)
    const passed = grew ?
      valueAfter * BPS > (wanted + tolerance) * after.total :
      valueAfter * BPS < (wanted - tolerance) * after.total
    if (passed) breaches.push({ rule: "overshoots", asset })
  }

  if (drift(after, limits.targets) > driftBefore - PROGRESS_BPS) breaches.push({ rule: "noProgress", asset: null })

  if (after.total * BPS < before.total * (BPS - BigInt(limits.priceProtection))) {
    breaches.push({ rule: "losesValue", asset: null })
  }

  return breaches
}
