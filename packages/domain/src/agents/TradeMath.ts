/**
 * The integer math behind an agent's rules, written so the contracts can repeat it exactly: values at Chainlink's
 * price rounded down, weights and drift in basis points, the price collar, and the slippage ledger that decays over
 * a week. Every rounding goes against the trader.
 *
 * @since 0.0.0
 */
import type { StockSymbol } from "../market/Market.ts"
import { type Price, type Shares, Usdc, valueOf } from "../market/Units.ts"
import type { Target } from "./Limits.ts"

const BPS = BigInt(10_000)

/**
 * What an account holds: cash and stock tokens, in their smallest units.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Holdings {
  readonly usdc: Usdc
  readonly shares: Readonly<Partial<Record<StockSymbol, Shares>>>
}

/**
 * A portfolio valued at Chainlink's prices: each asset's value and the total, in USDC units.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Valuation {
  readonly total: Usdc
  readonly values: ReadonlyMap<StockSymbol | "USDC", Usdc>
}

/**
 * `holdings` valued at `prices`; a stock without a price counts as worth nothing, so callers check prices first.
 *
 * @stability unstable
 * @category valuation
 * @since 0.0.0
 */
export const valueHoldings = (
  holdings: Holdings,
  prices: Readonly<Partial<Record<StockSymbol, Price>>>
): Valuation => {
  const values = new Map<StockSymbol | "USDC", Usdc>([["USDC", holdings.usdc]])
  let total = holdings.usdc as bigint

  for (const [symbol, shares] of Object.entries(holdings.shares) as Array<[StockSymbol, Shares]>) {
    const price = prices[symbol]
    const value = price === undefined ? Usdc.make(BigInt(0)) : valueOf(shares, price)
    values.set(symbol, value)
    total += value
  }

  return { total: Usdc.make(total), values }
}

/**
 * Whether `value` stays at or under `bps` of `total`: `value × 10,000 ≤ bps × total`, exact.
 *
 * @stability unstable
 * @category comparisons
 * @since 0.0.0
 */
export const isAtMostBps = (value: bigint, total: bigint, bps: number): boolean => value * BPS <= BigInt(bps) * total

/**
 * Whether `received` is within `collarBps` of `fair`: `received × 10,000 ≥ fair × (10,000 − collar)`, exact.
 *
 * @stability unstable
 * @category comparisons
 * @since 0.0.0
 */
export const isWithinCollar = (received: bigint, fair: bigint, collarBps: number): boolean =>
  received * BPS >= fair * (BPS - BigInt(collarBps))

/**
 * How far a portfolio is from its target mix, in basis points, rounded down: half the sum of each asset's distance
 * from its target (`½ Σ |wᵢ − tᵢ|`), computed on exact values so no asset's rounding adds up. Assets without a target
 * count against a target of zero.
 *
 * @stability unstable
 * @category rebalancing
 * @since 0.0.0
 */
export const drift = (valuation: Valuation, targets: ReadonlyArray<Target>): number => {
  if (valuation.total === BigInt(0)) return 0

  const assets = new Set<StockSymbol | "USDC">([...valuation.values.keys(), ...targets.map((target) => target.asset)])
  let distance = BigInt(0)

  for (const asset of assets) {
    const value = valuation.values.get(asset) ?? BigInt(0)
    const target = BigInt(targets.find((t) => t.asset === asset)?.weight ?? 0)
    const gap = value * BPS - target * valuation.total
    distance += gap < BigInt(0) ? -gap : gap
  }

  return Number(distance / (BigInt(2) * valuation.total))
}

/**
 * Seven days, in seconds: the window the slippage budget covers.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const SLIPPAGE_WINDOW_SECONDS = 7 * 24 * 60 * 60

/**
 * What an agent has lost to prices, as of `updatedAt` (Unix seconds). It decays linearly to nothing over seven days,
 * so the budget frees up gradually instead of all at once.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface SlippageLedger {
  readonly used: Usdc
  readonly updatedAt: number
}

/**
 * The ledger's loss at `now`, after decay: `used − used × elapsed / 7 days`, rounded up so the budget never frees up
 * early.
 *
 * @stability unstable
 * @category slippage
 * @since 0.0.0
 */
export const slippageUsed = (ledger: SlippageLedger, now: number): Usdc => {
  const elapsed = BigInt(Math.max(0, now - ledger.updatedAt))
  const window = BigInt(SLIPPAGE_WINDOW_SECONDS)
  if (elapsed >= window) return Usdc.make(BigInt(0))

  const remaining = ledger.used * (window - elapsed)
  return Usdc.make((remaining + window - BigInt(1)) / window)
}

/**
 * The ledger after a trade that lost `loss` at `now`.
 *
 * @stability unstable
 * @category slippage
 * @since 0.0.0
 */
export const chargeSlippage = (ledger: SlippageLedger, loss: Usdc, now: number): SlippageLedger => ({
  used: Usdc.make(slippageUsed(ledger, now) + loss),
  updatedAt: now
})
