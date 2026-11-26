// Trading in the made-up world, the way bluechip's pipeline does it: quotes from a pool that tracks Chainlink, the
// price check before signing, an agent's decision, and trades and intents moving through their statuses. Each change
// returns the live events the server would send, for the mock API (on a timer) and the panel (at once) alike.
import {
  Conflict,
  InsufficientCash,
  InsufficientShares,
  PriceCheckFailed,
  QuoteUnavailable
} from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, AutomationId, IntentId, TradeId } from "@bluechip/domain/Ids"
import { type Decision, Intent, type IntentEvent, type Leg, transition } from "@bluechip/domain/intents/Intent"
import { Quote, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween, lessBps, Price, priceOf, Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { MINIMUM_BUY, Trade, type TradeStatus, type TradeWarning } from "@bluechip/domain/trading/Trade"
import * as Result from "effect/Result"
import type { CastAgent } from "../cast.ts"
import type { IntentRecord, MarketSlice, MarketWorld, TradeRecord } from "./model.ts"
import { LISTINGS } from "./prices.ts"
import { type IntentInput, makeIntent, nextNumber, pricedTrade, txHashOf, utc } from "./records.ts"
import { marketStatusOf, referenceOf } from "./valuation.ts"

const MINUTE = 60_000

/** The largest trade an agent makes on its own, in dollars, by its preset. */
export const MAX_PER_TRADE: Readonly<Record<CastAgent["preset"], number>> = {
  conservative: 250,
  balanced: 1_000,
  active: 5_000
}

const dollars = (amount: number) => Usdc.make(BigInt(Math.round(amount * 1_000_000)))

/** The cast agent with `id`. */
export const agentOf = (world: MarketWorld, id: AgentId): CastAgent | undefined =>
  world.cast.agents.find((agent) => agent.id === id)

/** Whether an agent's session lets it trade now. */
export const canTrade = (agent: CastAgent): boolean =>
  agent.state === "active" || agent.state === "doneForToday" || agent.state === "asking"

const POOL_FEE_BPS = 5

/** What a trade would do in the stock's pool now: a pool that follows Chainlink, a little worse as trades grow. */
export const quoteOf = (
  market: MarketSlice,
  now: number,
  leg: Leg
): Result.Result<Quote, QuoteUnavailable> => {
  const reference = referenceOf(market, leg.symbol, now)
  if (reference === null) return Result.fail(new QuoteUnavailable({ symbol: leg.symbol, reason: "noPrice" }))
  if ("usdc" in leg.amount && leg.amount.usdc < MINIMUM_BUY) {
    return Result.fail(new QuoteUnavailable({ symbol: leg.symbol, reason: "belowMinimum" }))
  }

  const size = "usdc" in leg.amount ? leg.amount.usdc : valueOf(leg.amount.shares, reference.price)
  if (size === BigInt(0)) return Result.fail(new QuoteUnavailable({ symbol: leg.symbol, reason: "tooSmall" }))
  if (size > dollars(400_000)) return Result.fail(new QuoteUnavailable({ symbol: leg.symbol, reason: "tooLarge" }))

  const impact = POOL_FEE_BPS + Math.round(Number(size) / 5_000_000_000) + (market.apart === "pool" ? 160 : 0)
  const worse = leg.side === "buy" ? impact : -impact
  const price = Price.make((reference.price * BigInt(10_000 + worse)) / BigInt(10_000))
  const usdc = "usdc" in leg.amount ? leg.amount.usdc : valueOf(leg.amount.shares, price)
  const shares = "shares" in leg.amount ? leg.amount.shares : sharesFor(leg.amount.usdc, price)
  const filled = priceOf(usdc, shares)

  return Result.succeed(
    new Quote({
      symbol: leg.symbol,
      side: leg.side,
      usdc,
      shares,
      price: filled,
      reference,
      gapBps: leg.side === "buy" ? bpsBetween(filled, reference.price) : bpsBetween(reference.price, filled),
      minimumOut: lessBps(leg.side === "buy" ? shares : usdc, 50),
      pool: LISTINGS.find((listing) => listing.symbol === leg.symbol)!.pool as Quote["pool"],
      quotedAt: utc(now),
      expiresAt: utc(now + 30_000)
    })
  )
}

/**
 * The server's check before signing: the quote may be at most 1% from Chainlink (0.5% while prices are paused) and
 * Chainlink's price not stale; paused prices and a market apart from Chainlink are warnings.
 */
export const checkQuotes = (
  market: MarketSlice,
  quotes: ReadonlyArray<Quote>
): Result.Result<ReadonlyArray<TradeWarning>, PriceCheckFailed> => {
  const warnings = new Set<TradeWarning>()
  for (const quote of quotes) {
    const limitBps = quote.reference.status === "paused" ? 50 : 100
    if (quote.reference.status === "stale" || quote.gapBps > limitBps) {
      return Result.fail(
        new PriceCheckFailed({
          symbol: quote.symbol,
          reason: quote.reference.status === "stale" ? "stale" : "gap",
          gapBps: quote.gapBps,
          limitBps
        })
      )
    }
    if (quote.reference.status === "paused") warnings.add("pricesPaused")
    if (market.apart === "market") warnings.add("marketApart")
  }
  return Result.succeed([...warnings])
}

/** Whether the account has the cash for a buy, or the shares for a sale. */
export const checkFunds = (
  market: MarketSlice,
  leg: Leg
): Result.Result<void, InsufficientCash | InsufficientShares> => {
  if ("usdc" in leg.amount) {
    return leg.side === "buy" && leg.amount.usdc > market.cash ?
      Result.fail(new InsufficientCash({ available: market.cash })) :
      Result.void
  }
  const held = market.holdings.get(leg.symbol) ?? BigInt(0)
  return leg.side === "sell" && leg.amount.shares > held ?
    Result.fail(new InsufficientShares({ symbol: leg.symbol, available: held })) :
    Result.void
}

/** What an agent's policies decide about `leg` now, as the simulation would answer. */
export const decide = (
  world: MarketWorld,
  agent: CastAgent,
  leg: Leg,
  now: number
): Result.Result<Decision, Conflict | InsufficientCash | InsufficientShares> => {
  if (!canTrade(agent)) return Result.fail(new Conflict({ reason: "agentBusy" }))
  const funds = checkFunds(world.market, leg)
  if (Result.isFailure(funds)) return Result.fail(funds.failure)

  const name = LISTINGS.find((listing) => listing.symbol === leg.symbol)!.name
  if (!agent.stocks.includes(leg.symbol)) {
    return Result.succeed({
      _tag: "Refused",
      policy: "trade",
      error: "NotAllowed",
      stock: leg.symbol,
      message: `It doesn't trade ${name}.`
    })
  }
  if (agent.state === "doneForToday") {
    return Result.succeed({
      _tag: "Refused",
      policy: "tradesPerDay",
      error: null,
      stock: null,
      message: "It has made all of today's trades."
    })
  }

  const market = world.market
  if (market.feeds === "stale") {
    return Result.succeed({ _tag: "Wait", reason: "pricesStale", until: utc(now + 15 * MINUTE) })
  }
  const paused = market.feeds === "paused" || market.session === "weekend" || market.session === "holiday"
  if (paused && agent.template !== "rebalancer") {
    return Result.succeed({ _tag: "Wait", reason: "pricesPaused", until: marketStatusOf(market, now).changesAt })
  }

  const reference = referenceOf(market, leg.symbol, now)
  const size = "usdc" in leg.amount
    ? leg.amount.usdc
    : reference === null
    ? BigInt(0)
    : valueOf(leg.amount.shares, reference.price)
  const max = dollars(MAX_PER_TRADE[agent.preset])
  if (size > max) return Result.succeed({ _tag: "OverLargestTrade", maxPerTrade: max })
  return Result.succeed({ _tag: "Passes", callGasLimit: BigInt(412_000) })
}

/** Adds an intent to the slice. */
export const addIntent = (
  market: MarketSlice,
  input: Omit<IntentInput, "n">,
  automationId: AutomationId | null = null
): { readonly intent: Intent; readonly events: ReadonlyArray<LiveEvent> } => {
  const intent = makeIntent({ ...input, n: nextNumber(market) })
  market.intents.push({ intent, automationId })
  return { intent, events: [LiveEvent.cases.IntentChanged.make({ intent })] }
}

const recordOf = (market: MarketSlice, id: IntentId): IntentRecord | undefined =>
  market.intents.find((record) => record.intent.id === id)

/** Moves an intent on by `event` (or fails when it can't), with any other fields changed. */
export const advanceIntent = (
  market: MarketSlice,
  id: IntentId,
  event: IntentEvent,
  now: number,
  changes: Partial<Pick<Intent, "decision" | "tradeId" | "executor" | "expiresAt">> = {}
): Result.Result<{ readonly intent: Intent; readonly events: ReadonlyArray<LiveEvent> }, Conflict> => {
  const record = recordOf(market, id)
  if (record === undefined) return Result.fail(new Conflict({ reason: "intentChanged" }))
  const next = transition(record.intent.status, event)
  if (Result.isFailure(next)) return Result.fail(new Conflict({ reason: "intentClosed" }))

  record.intent = new Intent({
    ...record.intent,
    ...changes,
    ...(event._tag === "Decided" ? { decision: event.decision } : {}),
    status: next.success,
    updatedAt: utc(now)
  })
  return Result.succeed({
    intent: record.intent,
    events: [LiveEvent.cases.IntentChanged.make({ intent: record.intent })]
  })
}

/** Starts a trade (`sending`) for `leg` at the pool's price now. */
export const sendTrade = (
  market: MarketSlice,
  leg: Leg,
  agentId: AgentId | null,
  automationId: AutomationId | null,
  now: number
): TradeRecord => {
  const reference = referenceOf(market, leg.symbol, now)
  const n = nextNumber(market)
  const record: TradeRecord = {
    automationId,
    trade: pricedTrade({
      n,
      symbol: leg.symbol,
      side: leg.side,
      amount: leg.amount,
      reference: reference === null ? 0 : Number(reference.price) / 1e8,
      referenceStatus: reference?.status ?? "live",
      gapBps: POOL_FEE_BPS + (n % 4),
      agentId,
      status: "sending",
      at: now,
      settledAt: null
    })
  }
  market.trades.push(record)
  return record
}

/**
 * Moves a trade to `status`, and the intent behind it with it: once filled, its USDC and shares move between cash and
 * the holding. Nothing happens to a trade already filled or failed.
 */
export const advanceTrade = (
  market: MarketSlice,
  id: TradeId,
  status: Exclude<TradeStatus, "sending">,
  now: number
): ReadonlyArray<LiveEvent> => {
  const record = market.trades.find((candidate) => candidate.trade.id === id)
  if (record === undefined || record.trade.status === "filled" || record.trade.status === "failed") return []

  const trade = record.trade
  const n = market.trades.indexOf(record) + 1
  record.trade = new Trade({
    ...trade,
    status,
    txHash: trade.txHash ?? txHashOf(50_000 + n),
    settledAt: status === "confirming" ? null : utc(now)
  })
  const events: Array<LiveEvent> = [LiveEvent.cases.TradeUpdated.make({ trade: record.trade })]

  // A trade the panel fills at once skips confirming: its intent is accepted on the way.
  const intent = market.intents.find((candidate) => candidate.intent.tradeId === id)?.intent
  const steps: Array<IntentEvent> = []
  if (intent?.status === "sending" && status !== "failed") steps.push({ _tag: "Accepted" })
  if (status === "filled") steps.push({ _tag: "Filled" })
  if (status === "failed") steps.push({ _tag: "Failed" })
  for (const step of steps) {
    if (intent === undefined) break
    const moved = advanceIntent(market, intent.id, step, now)
    if (Result.isSuccess(moved)) events.push(...moved.success.events)
  }

  if (status === "filled") {
    const held = market.holdings.get(trade.symbol) ?? BigInt(0)
    const buy = trade.side === "buy"
    market.cash = buy ? market.cash - trade.usdc : market.cash + trade.usdc
    if (market.cash < BigInt(0)) market.cash = BigInt(0)
    market.holdings.set(trade.symbol, buy ? held + trade.shares : held > trade.shares ? held - trade.shares : BigInt(0))
    events.push(LiveEvent.cases.PortfolioChanged.make({}))
  }
  return events
}

/** Sends an intent's trade: the intent moves to `sending` with it. */
export const sendIntent = (
  market: MarketSlice,
  id: IntentId,
  event: IntentEvent,
  now: number
): { readonly trade: TradeRecord | null; readonly events: ReadonlyArray<LiveEvent> } => {
  const record = recordOf(market, id)
  if (record === undefined) return { trade: null, events: [] }

  const trade = sendTrade(market, record.intent.leg, record.intent.agentId, record.automationId, now)
  const moved = advanceIntent(market, id, event, now, { tradeId: trade.trade.id })
  if (Result.isFailure(moved)) {
    market.trades.pop()
    return { trade: null, events: [] }
  }
  return { trade, events: [...moved.success.events, LiveEvent.cases.TradeUpdated.make({ trade: trade.trade })] }
}

/** A leg of `amount` dollars (a buy) or shares worth about that much (a sale) of `symbol`. */
export const legOf = (market: MarketSlice, symbol: StockSymbol, side: Leg["side"], amount: number): Leg => {
  if (side === "buy") return { symbol, side, amount: { usdc: dollars(amount) } }
  const price = market.prices.get(symbol)?.price ?? 100
  const wanted = BigInt(Math.round((amount / price) * 1e8))
  const held = market.holdings.get(symbol) ?? BigInt(0)
  return { symbol, side, amount: { shares: Shares.make(held > BigInt(0) && held < wanted ? held : wanted) } }
}
