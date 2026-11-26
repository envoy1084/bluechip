// The market slice's records as the API returns them: made-up ids, and trades priced against Chainlink the way a
// fill in a pool would be.
import type { AgentId, IntentId, SigningRequestId, TradeId, TransferId, TxHash } from "@bluechip/domain/Ids"
import {
  type Decision,
  type Executor,
  Intent,
  type IntentSource,
  type IntentStatus,
  type Leg
} from "@bluechip/domain/intents/Intent"
import type { PriceStatus, StockSymbol } from "@bluechip/domain/market/Market"
import { Price, priceOf, Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { Trade, type TradeStatus } from "@bluechip/domain/trading/Trade"
import * as DateTime from "effect/DateTime"
import { previewId } from "../ids.ts"
import type { MarketSlice } from "./model.ts"
import { toPrice } from "./prices.ts"

export const tradeIdOf = (n: number) => previewId("trade", 10_000 + n) as TradeId
export const intentIdOf = (n: number) => previewId("intent", 20_000 + n) as IntentId
export const signingIdOf = (n: number) => previewId("signing", 30_000 + n) as SigningRequestId
export const transferIdOf = (n: number) => previewId("transfer", 40_000 + n) as TransferId
export const txHashOf = (n: number) => `0x${n.toString(16).padStart(8, "0")}${"5eedb1c4".repeat(7)}` as TxHash

/** A millisecond time as the API's `DateTime.Utc`. */
export const utc = (at: number): DateTime.Utc => DateTime.makeUnsafe(at)

/** The slice's next made-up id number. */
export const nextNumber = (market: MarketSlice): number => market.nextId++

/** A trade of `amount` at Chainlink's `reference` (dollars), `gapBps` worse for you, as a pool fills it. */
export const pricedTrade = (input: {
  readonly n: number
  readonly symbol: StockSymbol
  readonly side: "buy" | "sell"
  readonly amount: Leg["amount"]
  readonly reference: number
  readonly referenceStatus: PriceStatus
  readonly gapBps: number
  readonly agentId: AgentId | null
  readonly status: TradeStatus
  readonly at: number
  readonly settledAt: number | null
}): Trade => {
  const reference = toPrice(input.reference)
  const worse = input.side === "buy" ? input.gapBps : -input.gapBps
  const fill = Price.make((reference * BigInt(10_000 + worse)) / BigInt(10_000))
  const shares = "shares" in input.amount ? input.amount.shares : sharesFor(input.amount.usdc, fill)
  const usdc = "usdc" in input.amount ? input.amount.usdc : valueOf(input.amount.shares, fill)

  return new Trade({
    id: tradeIdOf(input.n),
    agentId: input.agentId,
    symbol: input.symbol,
    side: input.side,
    status: input.status,
    usdc: Usdc.make(usdc),
    shares: Shares.make(shares),
    price: priceOf(usdc, shares),
    reference,
    referenceStatus: input.referenceStatus,
    gapBps: input.gapBps,
    txHash: input.status === "sending" ? null : txHashOf(input.n),
    createdAt: utc(input.at),
    settledAt: input.settledAt === null ? null : utc(input.settledAt)
  })
}

/** The fields of an intent the slice's stories and mutations choose; the rest follow. */
export interface IntentInput {
  readonly n: number
  readonly agentId: AgentId | null
  readonly source: IntentSource
  readonly executor?: Executor
  readonly leg: Leg
  readonly reason?: string
  readonly status: IntentStatus
  readonly decision: Decision | null
  readonly batch?: { readonly id: string; readonly wave: number } | null
  readonly tradeId?: TradeId | null
  readonly expiresAt?: number | null
  readonly at: number
  readonly updatedAt?: number
}

/** An intent, worded as the server words it when no reason is given. */
export const makeIntent = (input: IntentInput): Intent =>
  new Intent({
    id: intentIdOf(input.n),
    agentId: input.agentId,
    source: input.source,
    executor: input.executor ?? (input.agentId === null ? "owner" : "agent"),
    leg: input.leg,
    reason: input.reason ?? (input.agentId === null ? "You traded." : "You asked this agent to trade."),
    status: input.status,
    decision: input.decision,
    batch: input.batch ?? null,
    tradeId: input.tradeId ?? null,
    expiresAt: input.expiresAt == null ? null : utc(input.expiresAt),
    createdAt: utc(input.at),
    updatedAt: utc(input.updatedAt ?? input.at)
  })
