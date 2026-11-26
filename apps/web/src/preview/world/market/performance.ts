// How the account is doing, from its fills the way the server's ledger works it out: lots replayed FIFO per stock
// (reconciled shares as flagged lots), profit realised and unrealised, costs, the daily profit chart, and each stock's,
// agent's and automation's part, with a rebalancer's drift.
import { driftOf } from "@bluechip/domain/automations/triggers/Drift"
import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import { series } from "@bluechip/domain/ledger/Daily"
import { type Closing, type Lot, type LotEntry, replay, unrealised } from "@bluechip/domain/ledger/Lots"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc, valueOf } from "@bluechip/domain/market/Units"
import {
  AgentLine,
  AgentPerformance,
  AutomationPerformance,
  BlockedBy,
  Costs,
  DriftPoint,
  HeldLot,
  PnlPoint,
  PortfolioPerformance,
  RunCount,
  StockLine,
  StockPerformance
} from "@bluechip/domain/performance/Performance"
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import type { Trade } from "@bluechip/domain/trading/Trade"
import type { CastAgent, CastAutomation } from "../cast.ts"
import type { MarketSlice, MarketWorld } from "./model.ts"
import { priceAt, toPrice } from "./prices.ts"
import { utc } from "./records.ts"
import { marketPriceOf, portfolioOf } from "./valuation.ts"

const HOUR = 3_600_000
const DAY = 24 * HOUR
const zero = BigInt(0)

type Entry = LotEntry & { readonly symbol: StockSymbol }

const filledTrades = (market: MarketSlice): ReadonlyArray<Trade> =>
  market.trades.map(({ trade }) => trade).filter((trade) => trade.status === "filled")

const settledAt = (trade: Trade) => (trade.settledAt ?? trade.createdAt).epochMilliseconds

/** Every change to the shares held, oldest first: fills, then what reconciliation found. */
const entriesOf = (market: MarketSlice): ReadonlyArray<Entry> =>
  [
    ...filledTrades(market).map((trade): Entry =>
      trade.side === "buy" ?
        {
          _tag: "Open",
          symbol: trade.symbol,
          source: trade.id,
          agentId: trade.agentId,
          shares: trade.shares,
          cost: trade.usdc,
          at: settledAt(trade),
          flagged: false
        } :
        {
          _tag: "Close",
          symbol: trade.symbol,
          source: trade.id,
          agentId: trade.agentId,
          shares: trade.shares,
          proceeds: trade.usdc,
          at: settledAt(trade),
          flagged: false
        }
    ),
    ...market.adjustments.map((adjustment, index): Entry => {
      const shares = Shares.make(adjustment.shares < zero ? -adjustment.shares : adjustment.shares)
      const worth = valueOf(shares, toPrice(adjustment.price))
      const common = {
        symbol: adjustment.symbol,
        source: `adjustment ${index}`,
        agentId: null,
        shares,
        at: adjustment.at,
        flagged: true
      }
      return adjustment.shares > zero
        ? { _tag: "Open", ...common, cost: worth }
        : { _tag: "Close", ...common, proceeds: worth }
    })
  ].sort((a, b) => a.at - b.at)

const costsOf = (trades: ReadonlyArray<Trade>): Costs =>
  new Costs({
    fees: trades.reduce((sum, trade) => sum + (trade.usdc * BigInt(5)) / BigInt(10_000), zero),
    slippage: trades.reduce((sum, trade) => sum + (trade.usdc * BigInt(trade.gapBps)) / BigInt(10_000), zero),
    gasWei: trades.reduce((sum, trade) => sum + BigInt(1_800_000_000_000) + BigInt(trade.gapBps * 40_000_000_000), zero)
  })

const symbolsOf = (
  entries: ReadonlyArray<Entry>
): ReadonlyArray<StockSymbol> => [...new Set(entries.map((entry) => entry.symbol))]

const replayOf = (entries: ReadonlyArray<Entry>, symbol: StockSymbol, until = Infinity) =>
  replay(entries.filter((entry) => entry.symbol === symbol && entry.at <= until))

/** Whose lots and sales count: everyone's, or one agent's. */
type Owner = { readonly agentId: AgentId } | null

const lotsFor = (lots: ReadonlyArray<Lot>, owner: Owner) =>
  lots.filter((lot) => lot.remaining > zero && (owner === null || lot.agentId === owner.agentId))

const closingsFor = (closings: ReadonlyArray<Closing>, owner: Owner) =>
  closings.filter((closing) => owner === null || closing.agentId === owner.agentId)

const priceNow = (market: MarketSlice, symbol: StockSymbol, now: number): Price =>
  marketPriceOf(market, symbol, now)?.price ?? Price.make(zero)

const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10)

/** The profit chart, a point per UTC day from the first fill, today's measured now. */
const seriesOf = (
  market: MarketSlice,
  entries: ReadonlyArray<Entry>,
  owner: Owner,
  now: number
): ReadonlyArray<PnlPoint> => {
  if (entries.length === 0) return []

  const rows: Array<{ day: string; realised: bigint; unrealised: bigint }> = []
  const first = Math.floor(entries[0]!.at / DAY) * DAY
  for (let start = first; start <= now; start += DAY) {
    const end = Math.min(start + DAY - 1, now)
    let realised = zero
    let held = zero
    for (const symbol of symbolsOf(entries)) {
      const { closings, lots } = replayOf(entries, symbol, end)
      realised += closingsFor(closings, owner)
        .filter((closing) => closing.at >= start)
        .reduce((sum, closing) => sum + closing.realised, zero)
      held += unrealised(lotsFor(lots, owner), toPrice(priceAt(market.book, market.prices.get(symbol)!, end)))
    }
    rows.push({ day: dayOf(start), realised, unrealised: held })
  }
  return series(rows).map((point) => new PnlPoint(point))
}

/** The whole portfolio's results. */
export const portfolioPerformanceOf = (world: MarketWorld, now: number): PortfolioPerformance => {
  const { cast, market } = world
  const entries = entriesOf(market)
  const trades = filledTrades(market)

  const stocks = symbolsOf(entries).map((symbol) => {
    const { closings, lots } = replayOf(entries, symbol)
    const held = lotsFor(lots, null)
    const shares = held.reduce((sum, lot) => sum + lot.remaining, zero)
    const price = priceNow(market, symbol, now)
    return new StockLine({
      symbol,
      shares: Shares.make(shares),
      cost: Usdc.make(held.reduce((sum, lot) => sum + lot.remainingCost, zero)),
      value: valueOf(Shares.make(shares), price),
      realised: closings.reduce((sum, closing) => sum + closing.realised, zero),
      unrealised: unrealised(held, price)
    })
  }).sort((a, b) => Number(b.value - a.value))

  const agentIds = [...new Set(trades.flatMap((trade) => (trade.agentId === null ? [] : [trade.agentId])))]
  const agents = agentIds.map((agentId) => {
    const result = agentResult(market, entries, agentId, now)
    return new AgentLine({
      agentId,
      name: cast.agents.find((agent) => agent.id === agentId)?.name ?? "Agent",
      realised: result.realised,
      unrealised: result.unrealised,
      costs: costsOf(trades.filter((trade) => trade.agentId === agentId)),
      trades: trades.filter((trade) => trade.agentId === agentId).length
    })
  }).sort((a, b) => Number(b.realised + b.unrealised - (a.realised + a.unrealised)))

  return new PortfolioPerformance({
    realised: stocks.reduce((sum, line) => sum + line.realised, zero),
    unrealised: stocks.reduce((sum, line) => sum + line.unrealised, zero),
    cost: Usdc.make(stocks.reduce((sum, line) => sum + line.cost, zero)),
    value: Usdc.make(stocks.reduce((sum, line) => sum + line.value, zero)),
    costs: costsOf(trades),
    trades: trades.length,
    flagged: market.adjustments.length,
    series: seriesOf(market, entries, null, now),
    stocks,
    agents
  })
}

const agentResult = (market: MarketSlice, entries: ReadonlyArray<Entry>, agentId: AgentId, now: number) => {
  let realised = zero
  let held = zero
  for (const symbol of symbolsOf(entries)) {
    const { closings, lots } = replayOf(entries, symbol)
    realised += closingsFor(closings, { agentId }).reduce((sum, closing) => sum + closing.realised, zero)
    held += unrealised(lotsFor(lots, { agentId }), priceNow(market, symbol, now))
  }
  return { realised, unrealised: held }
}

/** One stock's results: what's held and its lots, profit, costs and chart. */
export const stockPerformanceOf = (market: MarketSlice, symbol: StockSymbol, now: number): StockPerformance => {
  const entries = entriesOf(market).filter((entry) => entry.symbol === symbol)
  const trades = filledTrades(market).filter((trade) => trade.symbol === symbol)
  const { closings, lots } = replayOf(entries, symbol)
  const held = lotsFor(lots, null)
  const shares = Shares.make(held.reduce((sum, lot) => sum + lot.remaining, zero))
  const price = priceNow(market, symbol, now)

  return new StockPerformance({
    symbol,
    shares,
    cost: Usdc.make(held.reduce((sum, lot) => sum + lot.remainingCost, zero)),
    value: valueOf(shares, price),
    realised: closings.reduce((sum, closing) => sum + closing.realised, zero),
    unrealised: unrealised(held, price),
    costs: costsOf(trades),
    trades: trades.length,
    lots: held.map((lot) =>
      new HeldLot({
        symbol,
        agentId: lot.agentId as AgentId | null,
        shares: Shares.make(lot.shares),
        cost: Usdc.make(lot.cost),
        remaining: Shares.make(lot.remaining),
        remainingCost: Usdc.make(lot.remainingCost),
        openedAt: utc(lot.openedAt),
        flagged: lot.flagged
      })
    ),
    series: seriesOf(market, entries, null, now)
  })
}

/** A rebalancer's distance from its mix every 2 hours over 30 days, ending at today's. */
const driftOfAgent = (market: MarketSlice, agent: CastAgent, now: number): ReadonlyArray<DriftPoint> | null => {
  if (agent.targets.length === 0) return null
  const triggerBps = 500
  const current = driftOf(portfolioOf(market, now), { targets: agent.targets, triggerBps })
  const from = Math.max(now - 30 * DAY, now - agent.ageDays * DAY)

  const points: Array<DriftPoint> = []
  for (let at = from; at <= now; at += 2 * HOUR) {
    const cycle = ((at - from) / (7 * DAY)) % 1
    const usual = 60 + 430 * cycle + 18 * Math.sin(at / (5 * HOUR))
    const blend = Math.min(1, Math.max(0, (at - (now - 36 * HOUR)) / (36 * HOUR)))
    points.push(new DriftPoint({ at: utc(at), driftBps: Math.round(usual + (current - usual) * blend), triggerBps }))
  }
  return points
}

/** One agent's results, or `undefined` for an agent the cast doesn't have. */
export const agentPerformanceOf = (world: MarketWorld, agentId: AgentId, now: number): AgentPerformance | undefined => {
  const { cast, market } = world
  const agent = cast.agents.find((candidate) => candidate.id === agentId)
  if (agent === undefined) return undefined

  const entries = entriesOf(market)
  const trades = filledTrades(market).filter((trade) => trade.agentId === agentId)
  const intents = market.intents.map(({ intent }) => intent).filter((intent) => intent.agentId === agentId)
  const blocked = intents.filter((intent) => intent.status === "blocked")
  const policies = new Map<PolicyId, number>()
  for (const intent of blocked) {
    if (intent.decision?._tag === "Refused") {
      policies.set(intent.decision.policy, (policies.get(intent.decision.policy) ?? 0) + 1)
    }
  }
  const result = agentResult(market, entries, agentId, now)
  const total = (side: "buy" | "sell") =>
    Usdc.make(trades.filter((trade) => trade.side === side).reduce((sum, trade) => sum + trade.usdc, zero))

  return new AgentPerformance({
    agentId,
    realised: result.realised,
    unrealised: result.unrealised,
    bought: total("buy"),
    sold: total("sell"),
    costs: costsOf(trades),
    trades: trades.length,
    decided: intents.filter((intent) => intent.decision !== null).length,
    blocked: blocked.length,
    blockedBy: [...policies].map(([policy, count]) => new BlockedBy({ policy, count })),
    series: seriesOf(market, entries, { agentId }, now),
    drift: driftOfAgent(market, agent, now)
  })
}

const RUN_EXTRAS: Readonly<Record<CastAutomation["state"], { readonly skipped: number; readonly failed: number }>> = {
  active: { skipped: 2, failed: 0 },
  paused: { skipped: 1, failed: 0 },
  done: { skipped: 0, failed: 0 },
  failing: { skipped: 1, failed: 3 }
}

/** One automation's results, or `undefined` for an automation the cast doesn't have. */
export const automationPerformanceOf = (
  world: MarketWorld,
  automationId: AutomationId,
  now: number
): AutomationPerformance | undefined => {
  const { cast, market } = world
  const automation = cast.automations.find((candidate) => candidate.id === automationId)
  if (automation === undefined) return undefined

  const intents = market.intents.filter((record) => record.automationId === automationId).map(({ intent }) => intent)
  const tradeIds = new Set(intents.flatMap((intent) => (intent.tradeId === null ? [] : [intent.tradeId])))
  const trades = filledTrades(market).filter((trade) => tradeIds.has(trade.id))
  const entries = entriesOf(market)
  const realised = symbolsOf(entries).reduce(
    (sum, symbol) =>
      sum + replayOf(entries, symbol).closings
        .filter((closing) => tradeIds.has(closing.source as Trade["id"]))
        .reduce((total, closing) => total + closing.realised, zero),
    zero
  )

  const asked = intents.filter((intent) => intent.decision?._tag === "Ask").length
  const extras = cast.scenario === "newPerson" ? { skipped: 0, failed: 0 } : RUN_EXTRAS[automation.state]
  const counts = {
    proposed: intents.length - asked,
    asked,
    notified: automation.kind === "priceAlert" ? (cast.scenario === "heavy" ? 7 : 2) : 0,
    skipped: extras.skipped,
    failed: extras.failed
  }
  const runs = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const latest = Math.max(
    ...intents.map((intent) => intent.createdAt.epochMilliseconds),
    runs === 0 ? -Infinity : now - 2 * DAY
  )
  const total = (side: "buy" | "sell") =>
    Usdc.make(trades.filter((trade) => trade.side === side).reduce((sum, trade) => sum + trade.usdc, zero))

  return new AutomationPerformance({
    automationId,
    runs,
    outcomes: (["proposed", "asked", "notified", "skipped", "failed"] as const)
      .filter((outcome) => counts[outcome] > 0)
      .map((outcome) => new RunCount({ outcome, count: counts[outcome] })),
    trades: trades.length,
    bought: total("buy"),
    sold: total("sell"),
    realised,
    costs: costsOf(trades),
    lastRunAt: runs === 0 ? null : utc(latest)
  })
}
