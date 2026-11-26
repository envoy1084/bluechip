// Trade cards: an agent's trade as its policies decided it (sent, asking you, blocked, waiting), and your own trade
// prepared for Face ID, fresh or run out.
import type { Card } from "@bluechip/domain/assistant/Card"
import { limitsOf } from "@bluechip/domain/automations/AgentLimits"
import type { CardId } from "@bluechip/domain/Ids"
import type { Decision, IntentStatus, Leg, WaitReason } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import type { CastAgent } from "../../cast.ts"
import { intentOf, intentRequestOf, nameOf, shares, specOf, usdc } from "../castRecords.ts"
import type { Mint } from "../mint.ts"

export type TradeOutcome =
  | "proposed"
  | "deciding"
  | "sent"
  | "sending"
  | "confirming"
  | "failed"
  | "asking"
  | "approved"
  | "declined"
  | "expired"
  | "cancelled"
  | "blocked"
  | "waiting"

const buy = (symbol: StockSymbol, dollars: number): Leg => ({ symbol, side: "buy", amount: { usdc: usdc(dollars) } })

const sell = (symbol: StockSymbol, count: number): Leg => ({
  symbol,
  side: "sell",
  amount: { shares: shares(count) }
})

/** An agent's buy of `dollars` of `symbol` (its first stock unless said), decided as `outcome` says. */
export const tradeCard = (
  mint: Mint,
  agent: CastAgent,
  outcome: TradeOutcome,
  options: {
    readonly symbol?: StockSymbol
    readonly dollars?: number
    readonly hoursAgo?: number
    /** Sell this many shares instead of buying. */
    readonly sellShares?: number
    readonly batch?: { readonly id: string; readonly wave: number }
    /** Your own trade (no agent), as it is once you signed it. */
    readonly yours?: boolean
    /** Why a waiting trade waits; prices paused unless said. */
    readonly waitReason?: WaitReason
  } = {}
): Card => {
  const symbol = options.symbol ?? agent.stocks[0] ?? "NVDA"
  const largest = limitsOf(specOf(agent))?.maxPerTrade ?? usdc(100)
  // A trade over its largest trade is bigger than it, whichever way you answered it.
  const overLargest = ["asking", "approved", "declined", "expired", "cancelled"].includes(outcome)
  const dollars = options.dollars ?? (overLargest ? Number(largest) / 1e6 * 4 : 50)
  const at = mint.at(options.hoursAgo ?? 0)

  const passes: Decision = { _tag: "Passes", callGasLimit: BigInt(412_000) }
  const over: Decision = { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(largest) }
  const decided: Readonly<Record<TradeOutcome, { readonly status: IntentStatus; readonly decision: Decision | null }>> =
    {
      proposed: { status: "proposed", decision: null },
      deciding: { status: "deciding", decision: null },
      sent: { status: "filled", decision: passes },
      sending: { status: "sending", decision: passes },
      confirming: { status: "confirming", decision: passes },
      cancelled: { status: "cancelled", decision: over },
      failed: { status: "failed", decision: passes },
      asking: { status: "needsApproval", decision: over },
      approved: { status: "awaitingSignature", decision: over },
      declined: { status: "declined", decision: over },
      expired: { status: "expired", decision: over },
      blocked: {
        status: "blocked",
        decision: {
          _tag: "Refused",
          policy: "stockCap",
          error: "StockCapExceeded",
          stock: symbol,
          message: `${nameOf(symbol)} would be 34% of your portfolio, over ${agent.name}'s cap of 30% a stock.`
        }
      },
      waiting: {
        status: "waiting",
        decision: { _tag: "Wait", reason: options.waitReason ?? "pricesPaused", until: DateTime.add(at, { hours: 14 }) }
      }
    }

  return {
    _tag: "Trade",
    id: mint.id("card") as CardId,
    intent: intentOf(mint, {
      agentId: options.yours === true ? null : agent.id,
      leg: options.sellShares === undefined ? buy(symbol, dollars) : sell(symbol, options.sellShares),
      reason: options.sellShares === undefined ?
        `You asked for $${dollars} of ${nameOf(symbol)}.` :
        `You asked to sell ${options.sellShares} shares of ${nameOf(symbol)}.`,
      ...decided[outcome],
      hoursAgo: options.hoursAgo ?? 0,
      batch: options.batch ?? null
    })
  }
}

/** Your own buy, prepared for Face ID; `expired` once its two minutes ran out (approving prepares it again). */
export const approvalCard = (
  mint: Mint,
  options: {
    readonly symbol: StockSymbol
    readonly dollars: number
    readonly expired: boolean
    readonly hoursAgo?: number
    /** Other stocks of the same plan, sent with it by one signature. */
    readonly together?: ReadonlyArray<StockSymbol>
    /** The market is closed, so it trades at the pool's price. */
    readonly pricesPaused?: boolean
    /** Your first trade: it also sets up your account onchain. */
    readonly setsUpAccount?: boolean
  }
): Card => {
  const intent = intentOf(mint, {
    agentId: null,
    leg: buy(options.symbol, options.dollars),
    reason: `You asked to buy $${options.dollars} of ${nameOf(options.symbol)} yourself.`,
    status: "awaitingSignature",
    decision: null,
    hoursAgo: options.hoursAgo ?? 0
  })
  return {
    _tag: "Approval",
    id: mint.id("card") as CardId,
    intent,
    request: intentRequestOf(mint, intent, options.expired, {
      together: (options.together ?? []).map((symbol) =>
        intentOf(mint, {
          agentId: null,
          leg: buy(symbol, options.dollars),
          reason: `The same plan buys $${options.dollars} of ${nameOf(symbol)}.`,
          status: "awaitingSignature",
          decision: null,
          hoursAgo: options.hoursAgo ?? 0
        })
      ),
      warnings: options.pricesPaused === true ? ["pricesPaused", "marketApart"] : [],
      ...(options.setsUpAccount === undefined ? {} : { deploysAccount: options.setsUpAccount })
    })
  }
}
