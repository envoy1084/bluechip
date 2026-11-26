// Trade cards: an agent's trade as its policies decided it (sent, asking you, blocked, waiting), and your own trade
// prepared for Face ID, fresh or run out.
import type { Card } from "@bluechip/domain/assistant/Card"
import { limitsOf } from "@bluechip/domain/automations/AgentLimits"
import type { CardId } from "@bluechip/domain/Ids"
import type { Decision, IntentStatus, Leg } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import type { CastAgent } from "../../cast.ts"
import { intentOf, intentRequestOf, nameOf, specOf, usdc } from "../castRecords.ts"
import type { Mint } from "../mint.ts"

export type TradeOutcome = "sent" | "asking" | "blocked" | "waiting"

const buy = (symbol: StockSymbol, dollars: number): Leg => ({ symbol, side: "buy", amount: { usdc: usdc(dollars) } })

/** An agent's buy of `dollars` of `symbol` (its first stock unless said), decided as `outcome` says. */
export const tradeCard = (
  mint: Mint,
  agent: CastAgent,
  outcome: TradeOutcome,
  options: { readonly symbol?: StockSymbol; readonly dollars?: number; readonly hoursAgo?: number } = {}
): Card => {
  const symbol = options.symbol ?? agent.stocks[0] ?? "NVDA"
  const largest = limitsOf(specOf(agent))?.maxPerTrade ?? usdc(100)
  const dollars = options.dollars ?? (outcome === "asking" ? Number(largest) / 1e6 * 4 : 50)
  const at = mint.at(options.hoursAgo ?? 0)

  const decided: Readonly<Record<TradeOutcome, { readonly status: IntentStatus; readonly decision: Decision }>> = {
    sent: { status: "filled", decision: { _tag: "Passes", callGasLimit: BigInt(412_000) } },
    asking: { status: "needsApproval", decision: { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(largest) } },
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
      decision: { _tag: "Wait", reason: "pricesPaused", until: DateTime.add(at, { hours: 14 }) }
    }
  }

  return {
    _tag: "Trade",
    id: mint.id("card") as CardId,
    intent: intentOf(mint, {
      agentId: agent.id,
      leg: buy(symbol, dollars),
      reason: `You asked for $${dollars} of ${nameOf(symbol)}.`,
      ...decided[outcome],
      hoursAgo: options.hoursAgo ?? 0
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
    request: intentRequestOf(mint, intent, options.expired)
  }
}
