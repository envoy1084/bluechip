// The account's past, made up from the cast: the buys that add up to its holdings (yours and its agents'), a few
// stocks bought and sold again (gains and losses), rebalances sent as one plan, and the deposits that paid for it.
import type { Address, AgentId, AutomationId } from "@bluechip/domain/Ids"
import { waves } from "@bluechip/domain/intents/Batch"
import type { IntentSource, Leg } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { Transfer } from "@bluechip/domain/portfolio/Transfer"
import { ACCOUNT_ADDRESS, type Cast, type CastAgent } from "../cast.ts"
import { previewId } from "../ids.ts"
import type { IntentRecord, TradeRecord } from "./model.ts"
import { type LivePrice, priceAt, type PriceBook } from "./prices.ts"
import { makeIntent, pricedTrade, transferIdOf, txHashOf, utc } from "./records.ts"

const HOUR = 3_600_000
const DAY = 24 * HOUR
const SHARE = 100_000_000

/** Where withdrawals went: the person's own wallet. */
export const OWN_WALLET = "0x7a3b000000000000000000000000000000c0ffee" as Address

// Agents that have a session and so have traded; a draft or one still locking hasn't.
const hasTraded = (agent: CastAgent) => agent.state !== "draft" && agent.state !== "locking" && agent.ageDays >= 1

const REASONS: Readonly<Record<CastAgent["template"], string>> = {
  stockPicker: "Strong results and the price pulled back.",
  weeklyBuyer: "Your weekly buy.",
  rebalancer: "Back to the target mix.",
  stopLossGuard: "The price fell under your floor."
}

/** The automation an agent's trades run under, when it has one that trades. */
export const automationOfAgent = (cast: Cast, agent: CastAgent): AutomationId | null =>
  agent.template === "stockPicker" ?
    null :
    cast.automations.find((automation) => automation.agentId === agent.id && automation.kind !== "priceAlert")?.id ??
      null

interface PlannedFill {
  readonly at: number
  readonly symbol: StockSymbol
  readonly side: "buy" | "sell"
  readonly shares: bigint
  readonly agent: CastAgent | null
  readonly gapBps: number
  batch: { readonly id: string; readonly wave: number } | null
}

interface Slot {
  readonly agent: CastAgent | null
  readonly weight: number
  readonly at: number
}

/**
 * Who bought a holding and when: you, then each agent trading the stock, in proportion. Someone who just started
 * bought only what their agent doesn't trade, in the day and a half since their deposit.
 */
const slotsOf = (cast: Cast, symbol: StockSymbol, now: number): ReadonlyArray<Slot> => {
  const traders = cast.agents.filter((candidate) => candidate.stocks.includes(symbol) && hasTraded(candidate))
  const window = cast.scenario === "heavy" ? 170 : cast.scenario === "starter" ? 1.5 : 25
  const spread = (from: number, count: number, index: number) => {
    const start = Math.max(now - window * DAY, from)
    return start + ((now - 6 * HOUR - start) * (index + 0.5)) / count
  }

  const ownBuys = cast.scenario === "heavy" ? 2 : cast.scenario === "starter" && traders.length > 0 ? 0 : 1
  const slots: Array<Slot> = Array.from({ length: ownBuys }, (_, index) => ({
    agent: null,
    weight: 3,
    at: spread(now - window * DAY, ownBuys * 2, index) - 3 * HOUR
  }))

  for (const agent of traders) {
    const born = now - agent.ageDays * DAY + HOUR
    // An expired or removed agent stopped trading a while ago.
    const retired = agent.state === "expired" || agent.state === "removed"
    const last = retired ? now - Math.floor(agent.ageDays / 3) * DAY : now
    if (agent.template === "weeklyBuyer") {
      for (let week = 0; week * 7 < agent.ageDays - 1; week++) {
        const at = now - (week * 7 + 1) * DAY - 9 * HOUR
        if (at < last) slots.push({ agent, weight: 0.12, at })
      }
      continue
    }
    if (agent.template === "rebalancer") {
      slots.push({ agent, weight: 1.5, at: now - Math.floor(agent.ageDays / 2) * DAY - 2 * HOUR })
      continue
    }
    const count = cast.scenario === "heavy" ? 2 : 1
    for (let index = 0; index < count; index++) {
      slots.push({ agent, weight: 2, at: Math.min(spread(born, count, index), last - 6 * HOUR) })
    }
  }
  return slots
}

/** Buys adding up to each holding, exactly. */
const holdingBuys = (cast: Cast, now: number): Array<PlannedFill> =>
  cast.holdings.flatMap((holding, index) => {
    const total = BigInt(Math.round(holding.shares * SHARE))
    const slots = slotsOf(cast, holding.symbol, now)
    const weights = slots.map((slot) => BigInt(Math.round(slot.weight * 1_000)))
    const sum = weights.reduce((all, weight) => all + weight, BigInt(0))

    let left = total
    return slots.map((slot, slotIndex): PlannedFill => {
      const shares = slotIndex === slots.length - 1 ? left : (total * weights[slotIndex]!) / sum
      left -= shares
      return {
        at: slot.at,
        symbol: holding.symbol,
        side: "buy",
        shares,
        agent: slot.agent,
        gapBps: ((index * 7 + slotIndex * 3) % 13) - 3,
        batch: null
      }
    })
  })

/** Stocks bought and later sold again, so the ledger has realised gains and losses. */
const roundTrips = (cast: Cast, now: number): Array<PlannedFill> => {
  const agentFor = (symbol: StockSymbol, oldest: number) =>
    cast.agents.find((agent) =>
      agent.stocks.includes(symbol) && hasTraded(agent) && agent.ageDays > oldest && agent.template !== "rebalancer"
    ) ?? null
  const trip = (symbol: StockSymbol, shares: number, boughtDaysAgo: number, soldDaysAgo: number, gapBps: number) => {
    const agent = agentFor(symbol, boughtDaysAgo)
    const units = BigInt(Math.round(shares * SHARE))
    return [
      { at: now - boughtDaysAgo * DAY, symbol, side: "buy", shares: units, agent, gapBps, batch: null },
      {
        at: now - soldDaysAgo * DAY + 5 * HOUR,
        symbol,
        side: "sell",
        shares: units,
        agent,
        gapBps: gapBps + 2,
        batch: null
      }
    ] satisfies Array<PlannedFill>
  }

  if (cast.scenario === "typical") return trip("NVDA", 2, 20, 8, 4)
  if (cast.scenario !== "heavy") return []
  return [
    ...trip("INTC", 400, 160, 96, 6),
    ...trip("NVDA", 20, 190, 130, 3),
    ...trip("TSLA", 6, 182, 120, 9),
    ...trip("AAPL", 12, 181, 64, 2),
    ...trip("GOOGL", 30, 178, 41, -2),
    ...trip("MSTR", 0.0042, 90, 12, 11)
  ]
}

/** A rebalancer's buys of one moment are one plan, sent in waves. */
const batchRebalances = (fills: ReadonlyArray<PlannedFill>, cast: Cast) => {
  cast.agents.filter((agent) => agent.template === "rebalancer").forEach((agent, index) => {
    const legs = fills.filter((fill) => fill.agent === agent)
    const legsOf = (fill: PlannedFill): Leg => ({
      symbol: fill.symbol,
      side: fill.side,
      amount: { shares: Shares.make(fill.shares) }
    })
    const planned = waves(legs.map(legsOf))
    const id = previewId("batch", 100 + index)
    for (const fill of legs) {
      fill.batch = { id, wave: planned.findIndex((wave) => wave.some((leg) => leg.symbol === fill.symbol)) }
    }
  })
}

export interface History {
  readonly trades: Array<TradeRecord>
  readonly intents: Array<IntentRecord>
  readonly transfers: Array<Transfer>
  readonly nextId: number
}

/** The cast's past as trades, the intents behind them and transfers, oldest first. */
export const makeHistory = (
  cast: Cast,
  now: number,
  book: PriceBook,
  prices: ReadonlyMap<StockSymbol, LivePrice>
): History => {
  const fills = [...holdingBuys(cast, now), ...roundTrips(cast, now)].sort((a, b) => a.at - b.at)
  batchRebalances(fills, cast)

  let n = 1
  const trades: Array<TradeRecord> = []
  const intents: Array<IntentRecord> = []
  for (const fill of fills) {
    const number = n++
    const agentId: AgentId | null = fill.agent?.id ?? null
    const automationId = fill.agent === null ? null : automationOfAgent(cast, fill.agent)
    const trade = pricedTrade({
      n: number,
      symbol: fill.symbol,
      side: fill.side,
      amount: { shares: Shares.make(fill.shares) },
      reference: priceAt(book, prices.get(fill.symbol)!, fill.at),
      referenceStatus: "live",
      gapBps: fill.gapBps,
      agentId,
      status: "filled",
      at: fill.at,
      settledAt: fill.at + 14_000
    })
    const source: IntentSource = fill.agent === null ? "owner" : automationId === null ? "assistant" : "automation"
    const leg: Leg = fill.side === "buy" ?
      { symbol: fill.symbol, side: "buy", amount: { usdc: trade.usdc } } :
      { symbol: fill.symbol, side: "sell", amount: { shares: trade.shares } }

    trades.push({ trade, automationId })
    intents.push({
      automationId,
      intent: makeIntent({
        n: number,
        agentId,
        source,
        leg,
        ...(fill.agent === null ? {} : { reason: REASONS[fill.agent.template] }),
        status: "filled",
        decision: fill.agent === null ? null : { _tag: "Passes", callGasLimit: BigInt(380_000 + number * 1_700) },
        batch: fill.batch,
        tradeId: trade.id,
        at: fill.at - 6_000,
        updatedAt: fill.at + 14_000
      })
    })
  }

  return { trades, intents, transfers: transfersOf(cast, now, trades, n), nextId: n + 50 }
}

/** Deposits (and, for the heavy user, a withdrawal) that leave the cast's cash after its trades: one for a starter. */
const transfersOf = (cast: Cast, now: number, trades: ReadonlyArray<TradeRecord>, from: number): Array<Transfer> => {
  if (trades.length === 0 && cast.cash === 0) return []

  const spent = trades.reduce(
    (sum, { trade }) => sum + (trade.side === "buy" ? trade.usdc : -trade.usdc),
    BigInt(0)
  )
  const dollars = (amount: number) => BigInt(Math.round(amount * 1_000_000))
  const later: ReadonlyArray<
    { readonly kind: "deposit" | "withdrawal"; readonly amount: bigint; readonly at: number }
  > = cast.scenario === "heavy" ?
    [
      { kind: "deposit", amount: dollars(5_000), at: now - 100 * DAY },
      { kind: "deposit", amount: dollars(2_500), at: now - 30 * DAY },
      { kind: "withdrawal", amount: dollars(1_200), at: now - 20 * DAY },
      { kind: "deposit", amount: dollars(0.5), at: now - 2 * DAY }
    ] :
    cast.scenario === "starter" ?
    [] :
    [{ kind: "deposit", amount: dollars(1_000), at: now - 12 * DAY }]
  const net = later.reduce((sum, move) => sum + (move.kind === "deposit" ? move.amount : -move.amount), BigInt(0))
  const first = trades[0]?.trade.createdAt.epochMilliseconds ?? now - 3 * DAY
  const opening = { kind: "deposit" as const, amount: dollars(cast.cash) + spent - net, at: first - 2 * HOUR }

  return [opening, ...later].map((move, index) =>
    new Transfer({
      id: transferIdOf(from + index),
      kind: move.kind,
      asset: "USDC",
      amount: Usdc.make(move.amount),
      from: move.kind === "deposit" ? OWN_WALLET : ACCOUNT_ADDRESS as Address,
      to: move.kind === "deposit" ? ACCOUNT_ADDRESS as Address : OWN_WALLET,
      status: "confirmed",
      txHash: txHashOf(90_000 + from + index),
      createdAt: utc(move.at)
    })
  )
}
