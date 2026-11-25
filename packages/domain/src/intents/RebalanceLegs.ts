/**
 * The trades that bring a portfolio back to a rebalancer's target mix. The agent's onchain policies still decide each
 * one; this only proposes them.
 *
 * @since 0.0.0
 */
import type { StockSymbol } from "../market/Market.ts"
import { type Price, Shares, sharesFor, Usdc } from "../market/Units.ts"
import type { RebalanceConfig } from "../policies/Rebalance.ts"
import type { Portfolio } from "../portfolio/Portfolio.ts"
import type { Leg } from "./Intent.ts"

const BPS = BigInt(10_000)

/**
 * One leg per stock more than the trigger away from its target: a sell of the shares above target, or a buy of the
 * dollars below it. Sells come first, so their cash is there for the buys. A stock without a price is left alone.
 *
 * **Example** (All cash, half of it meant for Nvidia)
 *
 * ```ts import.meta.vitest
 * import { rebalanceLegs } from "@bluechip/domain/intents/RebalanceLegs"
 *
 * const portfolio = { value: 1_000_000_000n, holdings: [] } as never
 * const config = { targets: [{ asset: "NVDA", weight: 5000 }, { asset: "USDC", weight: 5000 }], triggerBps: 500 } as never
 * rebalanceLegs(portfolio, config, new Map([["NVDA", 15_000_000_000n]]) as never)
 * // => [{ symbol: "NVDA", side: "buy", amount: { usdc: 500_000_000n } }]
 * ```
 *
 * @stability unstable
 * @category planning
 * @since 0.0.0
 */
export const rebalanceLegs = (
  portfolio: Pick<Portfolio, "value" | "holdings">,
  config: RebalanceConfig,
  prices: ReadonlyMap<StockSymbol, Price>
): ReadonlyArray<Leg> => {
  if (portfolio.value === BigInt(0)) return []
  const sells: Array<Leg> = []
  const buys: Array<Leg> = []

  for (const target of config.targets) {
    if (target.asset === "USDC") continue
    const symbol = target.asset
    const holding = portfolio.holdings.find((candidate) => candidate.symbol === symbol)
    const price = holding?.price?.price ?? prices.get(symbol)
    if (price === undefined) continue

    const current = holding?.value ?? BigInt(0)
    const desired = (portfolio.value * BigInt(target.weight)) / BPS
    const gap = desired - current
    const drift = ((gap < 0 ? -gap : gap) * BPS) / portfolio.value
    if (drift < BigInt(config.triggerBps)) continue

    if (gap > 0) {
      buys.push({ symbol, side: "buy", amount: { usdc: Usdc.make(gap) } })
    } else {
      const held = holding?.shares ?? BigInt(0)
      const shares = sharesFor(Usdc.make(-gap), price)
      sells.push({ symbol, side: "sell", amount: { shares: Shares.make(shares < held ? shares : held) } })
    }
  }
  return [...sells, ...buys]
}
