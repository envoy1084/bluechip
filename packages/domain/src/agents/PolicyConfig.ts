/**
 * The numbers an agent's onchain policies are configured with, from its limits: bluechip's validation policy (what
 * may be called and how much), its execution policy (prices and the portfolio) and Namera's rate limit. Stocks are
 * named by symbol here; the chain package adds their token and feed addresses when it encodes the policies.
 *
 * @since 0.0.0
 */
import { StockSymbol } from "../market/Market.ts"
import { Usdc } from "../market/Units.ts"
import {
  type AgentMode,
  type Asset,
  GRANT_DAYS,
  type Limits,
  LIVE_PRICE_SECONDS,
  MIN_TRADE,
  OVERSHOOT_BPS,
  PAUSED_PRICE_SECONDS,
  PROGRESS_BPS,
  rebalanceBand
} from "./Limits.ts"
import { SLIPPAGE_WINDOW_SECONDS } from "./TradeMath.ts"

/**
 * One UTC day, in seconds: the period of the daily budget and the trade count.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DAY_SECONDS = 24 * 60 * 60

/**
 * The validation policy's settings: the stocks, which way, the most USDC per buy and per UTC day.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface TradePolicyConfig {
  readonly stocks: ReadonlyArray<StockSymbol>
  readonly mode: AgentMode
  /** The lower of the max per trade and "ask me above": bigger buys are yours to sign. */
  readonly maxUsdcIn: Usdc
  readonly dailyBudget: Usdc
  readonly budgetPeriodSeconds: number
}

/**
 * The execution policy's settings: every stock it values, the ones the agent trades, and each price and portfolio
 * rule.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface TradeGuardConfig {
  /** Every stock the portfolio is valued over. */
  readonly valued: ReadonlyArray<StockSymbol>
  readonly allowed: ReadonlyArray<StockSymbol>
  readonly mode: AgentMode
  readonly tradeWhilePaused: boolean
  /** The most a trade may be worth at Chainlink's price, buy or sell. */
  readonly maxTradeUsd: Usdc
  readonly minTradeUsd: Usdc
  readonly maxInOneStockBps: number
  readonly cashReserveBps: number
  readonly targets: ReadonlyArray<{ readonly asset: Asset; readonly weight: number }>
  readonly collarBps: number
  readonly pausedCollarBps: number
  readonly liveAgeSeconds: number
  readonly pausedAgeSeconds: number
  readonly weeklySlippageBps: number
  readonly slippageWindowSeconds: number
  readonly bandBps: number
  readonly overshootBps: number
  readonly progressBps: number
}

/**
 * Everything an agent's session is configured with.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface PolicyConfig {
  readonly trade: TradePolicyConfig
  readonly guard: TradeGuardConfig
  readonly tradesPerDay: number
  readonly expiresAfterSeconds: number
}

/**
 * The policy settings for `limits`. An agent's key may never sign more than "ask me above", so that cap applies to
 * buys (in validation) and sells (in execution) alike.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const policyConfig = (limits: Limits): PolicyConfig => {
  const maxTrade = Usdc.make(limits.askAbove < limits.maxPerTrade ? limits.askAbove : limits.maxPerTrade)

  return {
    trade: {
      stocks: limits.stocks,
      mode: limits.mode,
      maxUsdcIn: maxTrade,
      dailyBudget: limits.dailyBudget,
      budgetPeriodSeconds: DAY_SECONDS
    },
    guard: {
      valued: StockSymbol.literals,
      allowed: limits.stocks,
      mode: limits.mode,
      tradeWhilePaused: limits.tradeWhilePaused && limits.mode !== "rebalance",
      maxTradeUsd: maxTrade,
      minTradeUsd: MIN_TRADE,
      maxInOneStockBps: limits.maxInOneStock,
      cashReserveBps: limits.cashReserve,
      targets: limits.targets.map(({ asset, weight }) => ({ asset, weight })),
      collarBps: limits.priceProtection,
      pausedCollarBps: limits.priceProtection / 2,
      liveAgeSeconds: LIVE_PRICE_SECONDS,
      pausedAgeSeconds: PAUSED_PRICE_SECONDS,
      weeklySlippageBps: limits.weeklySlippage,
      slippageWindowSeconds: SLIPPAGE_WINDOW_SECONDS,
      bandBps: rebalanceBand(limits.rebalanceTrigger),
      overshootBps: OVERSHOOT_BPS,
      progressBps: PROGRESS_BPS
    },
    tradesPerDay: limits.tradesPerDay,
    expiresAfterSeconds: GRANT_DAYS * DAY_SECONDS
  }
}
