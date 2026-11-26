// What the preview's market slice holds: the market's settings and prices, and the account's money, trades and
// intents, changed in place by the mock API and the panel.
import type { AgentId, AutomationId, IntentId, SigningRequestId } from "@bluechip/domain/Ids"
import type { Intent, Leg } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Transfer } from "@bluechip/domain/portfolio/Transfer"
import type { Trade } from "@bluechip/domain/trading/Trade"
import type { Cast } from "../cast.ts"
import type { DayMove, LivePrice, PriceBook } from "./prices.ts"

/** The market's session as the panel sets it: the four moving sessions, or prices paused for a weekend or a holiday. */
export type SessionSetting = "regular" | "preMarket" | "afterHours" | "overnight" | "weekend" | "holiday"

/** How Chainlink's feeds answer. */
export type FeedSetting = "live" | "paused" | "stale"

/**
 * Whether prices disagree: the stock market over 1% from Chainlink (a warning before signing), or the pools over 1%
 * from it (the price check refuses the trade).
 */
export type ApartSetting = "none" | "market" | "pool"

/** A trade, and the automation whose run made it, if any. */
export interface TradeRecord {
  trade: Trade
  readonly automationId: AutomationId | null
}

/** An intent, and the automation whose run made it, if any. */
export interface IntentRecord {
  intent: Intent
  readonly automationId: AutomationId | null
}

/** Shares that arrived or left outside bluechip's trades, found by reconciliation (flagged in the ledger). */
export interface Adjustment {
  readonly symbol: StockSymbol
  /** Signed: positive when shares arrived. */
  readonly shares: bigint
  /** The market price when it was found, dollars. */
  readonly price: number
  readonly at: number
}

/** What a passkey signature sends: your own trade (`intentId: null`, a trade of `trades`), or intents. */
export interface SigningPlan {
  readonly id: SigningRequestId
  readonly kind: "trade" | "intents"
  readonly agentId: AgentId | null
  readonly legs: ReadonlyArray<{ readonly intentId: IntentId | null; readonly leg: Leg }>
  readonly expiresAt: number
}

export interface MarketSlice {
  session: SessionSetting
  feeds: FeedSetting
  move: DayMove
  apart: ApartSetting
  /** SpaceX without a market or Chainlink price. */
  missingPrice: boolean
  /** Whether prices tick every few seconds in the tab. */
  ticking: boolean
  readonly book: PriceBook
  prices: Map<StockSymbol, LivePrice>
  /** USDC base units. */
  cash: bigint
  /** Share base units by stock. */
  holdings: Map<StockSymbol, bigint>
  trades: Array<TradeRecord>
  intents: Array<IntentRecord>
  /** Deposits and withdrawals, for the activity feed. */
  transfers: Array<Transfer>
  adjustments: Array<Adjustment>
  requests: Map<string, SigningPlan>
  /** The next number for a made-up id. */
  nextId: number
}

/** The parts of the world trading reads: the cast (its agents) and the market slice. */
export interface MarketWorld {
  readonly cast: Cast
  readonly market: MarketSlice
}
