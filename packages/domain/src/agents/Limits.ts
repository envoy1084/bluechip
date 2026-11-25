/**
 * An agent's limits: what it may trade, which way, how much and how often, and the safety settings its trades are
 * checked with. Amounts are in onchain units (USDC 6 decimals, ratios in basis points), so bluechip's checks and the
 * contracts that enforce the same limits onchain compute exactly the same thing.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../market/Market.ts"
import { Usdc } from "../market/Units.ts"

/**
 * Which way an agent trades: only buys, only sells, both, or only back toward your target mix.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AgentMode = Schema.Literals(["buy", "sell", "both", "rebalance"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AgentMode = typeof AgentMode.Type

/**
 * Something a portfolio holds: a stock, or cash (USDC).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Asset = Schema.Union([StockSymbol, Schema.Literal("USDC")])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Asset = typeof Asset.Type

/**
 * How far a fill may be from Chainlink's price, in basis points: strict, standard or relaxed. While prices are
 * paused the limit is half of this.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PriceProtection = Schema.Literals([50, 100, 200])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PriceProtection = typeof PriceProtection.Type

/**
 * The most an agent may lose to prices (fills against Chainlink's price) over seven days, in basis points of the
 * portfolio.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const WeeklySlippage = Schema.Literals([50, 100, 200])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type WeeklySlippage = typeof WeeklySlippage.Type

/**
 * How far off target a portfolio must drift, in basis points, before a Rebalancer starts trading.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const RebalanceTrigger = Schema.Literals([300, 500, 1000])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type RebalanceTrigger = typeof RebalanceTrigger.Type

/**
 * One asset's share of the target mix, in basis points.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Target extends Schema.Class<Target>("@bluechip/domain/agents/Limits/Target")({
  asset: Asset,
  weight: Schema.Int
}) {}

/**
 * An agent's limits, as you lock them with Face ID.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Limits extends Schema.Class<Limits>("@bluechip/domain/agents/Limits/Limits")({
  /** The stocks it may trade. */
  stocks: Schema.Array(StockSymbol),
  mode: AgentMode,
  /** USDC it may put into buys per UTC day; 0 for an agent that never buys. */
  dailyBudget: Usdc,
  /** The largest single trade, in dollars. */
  maxPerTrade: Usdc,
  /** Trades above this wait for your Face ID; 0 means every trade does. */
  askAbove: Usdc,
  /** The largest share of your portfolio a stock may reach through its trades, in basis points. */
  maxInOneStock: Schema.Int,
  /** The smallest share of your portfolio its trades may leave in cash, in basis points. */
  cashReserve: Schema.Int,
  /** The target mix (Rebalancer only), summing to 10,000 basis points; empty otherwise. */
  targets: Schema.Array(Target),
  /** Operations it may send per UTC day. */
  tradesPerDay: Schema.Int,
  priceProtection: PriceProtection,
  weeklySlippage: WeeklySlippage,
  rebalanceTrigger: RebalanceTrigger,
  /** Whether it trades while Chainlink's prices are paused (weekends and holidays). */
  tradeWhilePaused: Schema.Boolean
}) {}

/**
 * How long a lock lasts before the agent needs your Face ID again: 90 days.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const GRANT_DAYS = 90

/**
 * Prices up to this old are live: Chainlink's stock feeds update on a 0.5% move or every 24 hours, plus slack.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const LIVE_PRICE_SECONDS = 26 * 60 * 60

/**
 * Prices up to this old are paused rather than broken: the longest weekend with a holiday, plus slack. Older prices
 * are stale and nothing trades on them.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const PAUSED_PRICE_SECONDS = 80 * 60 * 60

/**
 * The smallest trade an agent makes: $5.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MIN_TRADE = Usdc.make(BigInt(5_000_000))

/**
 * How far past its target a Rebalancer may push an asset, in basis points of the portfolio.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const OVERSHOOT_BPS = 5

/**
 * How much a rebalance must reduce the drift from target, in basis points.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const PROGRESS_BPS = 10

/**
 * The drift below which a portfolio counts as on target: a fifth of the trigger (1% for a 5% trigger).
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const rebalanceBand = (trigger: RebalanceTrigger): number => trigger / 5
