// What your passkey signs: your own trades, and agents' trades waiting for your approval (a plan's other legs go with
// the same signature), prepared as the server prepares them and sent once signed.
import { Conflict, NotFound, type PriceCheckFailed, type QuoteUnavailable } from "@bluechip/domain/Errors"
import type { LiveEvent } from "@bluechip/domain/Events"
import type { IntentId } from "@bluechip/domain/Ids"
import { waves } from "@bluechip/domain/intents/Batch"
import { type Intent, IntentRequest, type Leg } from "@bluechip/domain/intents/Intent"
import { rebalanceLegs } from "@bluechip/domain/intents/RebalanceLegs"
import type { Quote, StockSymbol } from "@bluechip/domain/market/Market"
import { type Price, Usdc } from "@bluechip/domain/market/Units"
import { TradeRequest } from "@bluechip/domain/trading/Trade"
import * as Result from "effect/Result"
import type { CastAgent } from "../cast.ts"
import { previewId } from "../ids.ts"
import { automationOfAgent } from "./history.ts"
import type { MarketSlice, MarketWorld, SigningPlan, TradeRecord } from "./model.ts"
import { nameOf } from "./prices.ts"
import { nextNumber, signingIdOf, utc } from "./records.ts"
import {
  addIntent,
  advanceIntent,
  canTrade,
  checkQuotes,
  legOf,
  MAX_PER_TRADE,
  quoteOf,
  sendIntent,
  sendTrade
} from "./trading.ts"
import { marketPriceOf, portfolioOf } from "./valuation.ts"

const MINUTE = 60_000

/** The WebAuthn request options a signature answers; preview passkeys accept any. */
const ceremonyOptions = (plan: SigningPlan): Record<string, unknown> => ({
  challenge: btoa(plan.id).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_"),
  rpId: globalThis.location?.hostname ?? "localhost",
  allowCredentials: [{ id: "cHJldmlldy1wYXNza2V5", type: "public-key", transports: ["internal"] }],
  userVerification: "required",
  timeout: 120_000
})

// The account's first operation deploys it.
const deploysAccount = (market: MarketSlice) => market.trades.every(({ trade }) => trade.status !== "filled")

const newPlan = (market: MarketSlice, plan: Omit<SigningPlan, "id" | "expiresAt">, now: number): SigningPlan => {
  const signing: SigningPlan = { ...plan, id: signingIdOf(nextNumber(market)), expiresAt: now + 5 * MINUTE }
  market.requests.set(signing.id, signing)
  return signing
}

/** Your own trade, quoted and checked, for your passkey. */
export const prepareTrade = (
  market: MarketSlice,
  leg: Leg,
  now: number
): Result.Result<TradeRequest, QuoteUnavailable | PriceCheckFailed> =>
  Result.gen(function*() {
    const quote = yield* quoteOf(market, now, leg)
    const warnings = yield* checkQuotes(market, [quote])
    const plan = newPlan(market, { kind: "trade", agentId: null, legs: [{ intentId: null, leg }] }, now)
    return new TradeRequest({
      id: plan.id,
      options: ceremonyOptions(plan),
      quote,
      warnings,
      deploysAccount: deploysAccount(market),
      expiresAt: utc(plan.expiresAt)
    })
  })

/**
 * Prepares intent `id` for your passkey with the other legs of its plan still waiting for you (one per stock): they
 * move to `awaitingSignature`, signed by you.
 */
export const prepareIntents = (
  world: MarketWorld,
  id: IntentId,
  now: number
): Result.Result<
  { readonly request: IntentRequest; readonly events: ReadonlyArray<LiveEvent> },
  NotFound | Conflict | QuoteUnavailable | PriceCheckFailed
> =>
  Result.gen(function*() {
    const market = world.market
    const root = market.intents.find((record) => record.intent.id === id)?.intent
    if (root === undefined) return yield* Result.fail(new NotFound({ resource: "intent", id }))
    const agent = root.agentId === null
      ? undefined
      : world.cast.agents.find((candidate) => candidate.id === root.agentId)
    if (agent !== undefined && !canTrade(agent)) return yield* Result.fail(new Conflict({ reason: "agentBusy" }))

    const rows: Array<Intent> = [root]
    for (const { intent } of market.intents) {
      const waiting = intent.status === "needsApproval" || intent.status === "awaitingSignature"
      const mate = root.batch !== null && intent.batch?.id === root.batch.id && intent.agentId === root.agentId
      if (waiting && mate && !rows.some((taken) => taken.leg.symbol === intent.leg.symbol)) rows.push(intent)
    }

    const quotes: Array<Quote> = []
    for (const row of rows) quotes.push(yield* quoteOf(market, now, row.leg))
    const warnings = yield* checkQuotes(market, quotes)
    const plan = newPlan(market, {
      kind: "intents",
      agentId: root.agentId,
      legs: rows.map((row) => ({ intentId: row.id, leg: row.leg }))
    }, now)

    const events: Array<LiveEvent> = []
    const prepared = rows.map((row) => {
      if (row.status === "awaitingSignature") return row
      const moved = advanceIntent(market, row.id, { _tag: "Prepared" }, now, {
        executor: "owner",
        expiresAt: utc(plan.expiresAt)
      })
      if (Result.isFailure(moved)) return row
      events.push(...moved.success.events)
      return moved.success.intent
    })

    return {
      events,
      request: new IntentRequest({
        id: plan.id,
        options: ceremonyOptions(plan),
        intent: prepared[0]!,
        quote: quotes[0]!,
        warnings,
        together: prepared.slice(1).map((intent, index) => ({ intent, quote: quotes[index + 1]! })),
        deploysAccount: deploysAccount(market),
        expiresAt: utc(plan.expiresAt)
      })
    }
  })

/** Sends what a signed plan holds: your trade, or its intents, each with its trade. */
export const confirmPlan = (
  market: MarketSlice,
  planId: string,
  now: number
): Result.Result<
  {
    readonly trades: ReadonlyArray<TradeRecord>
    readonly intent: Intent | null
    readonly events: ReadonlyArray<LiveEvent>
  },
  NotFound
> => {
  const plan = market.requests.get(planId)
  if (plan === undefined) return Result.fail(new NotFound({ resource: "signingRequest", id: planId }))
  market.requests.delete(planId)

  if (plan.kind === "trade") {
    const trade = sendTrade(market, plan.legs[0]!.leg, null, null, now)
    return Result.succeed({ trades: [trade], intent: null, events: [] })
  }

  const trades: Array<TradeRecord> = []
  const events: Array<LiveEvent> = []
  for (const { intentId } of plan.legs) {
    if (intentId === null) continue
    const sent = sendIntent(market, intentId, { _tag: "Signed" }, now)
    if (sent.trade !== null) trades.push(sent.trade)
    events.push(...sent.events)
  }
  const first = plan.legs[0]?.intentId
  const intent = market.intents.find((record) => record.intent.id === first)?.intent ?? null
  return Result.succeed({ trades, intent, events })
}

/**
 * A plan's legs for an agent: a rebalancer's from its target mix, any other's across its stocks. A plan of three or
 * more splits its biggest buy in two, as a trade over the agent's largest is split, so it goes out in two waves.
 */
const planLegs = (world: MarketWorld, agent: CastAgent, count: number, now: number): ReadonlyArray<Leg> => {
  const market = world.market
  const prices = new Map<StockSymbol, Price>()
  for (const symbol of market.prices.keys()) {
    const price = marketPriceOf(market, symbol, now)
    if (price !== null) prices.set(symbol, price.price)
  }

  const fromMix = agent.targets.length === 0 ?
    [] :
    rebalanceLegs(portfolioOf(market, now), { targets: agent.targets, triggerBps: 500 }, prices)
  const wanted = count >= 3 ? count - 1 : count
  const legs = fromMix.slice(0, wanted)
  for (const symbol of agent.stocks) {
    if (legs.length >= wanted) break
    if (legs.some((leg) => leg.symbol === symbol)) continue
    const held = (market.holdings.get(symbol) ?? BigInt(0)) > BigInt(0)
    legs.push(legOf(market, symbol, held && legs.length === 0 ? "sell" : "buy", 300 + legs.length * 140))
  }
  if (count < 3) return legs

  const biggest = legs.reduce<Leg | undefined>(
    (most, leg) =>
      "usdc" in leg.amount && (most === undefined || ("usdc" in most.amount && leg.amount.usdc > most.amount.usdc)) ?
        leg :
        most,
    undefined
  )
  if (biggest === undefined || !("usdc" in biggest.amount)) return legs
  const half = Usdc.make(biggest.amount.usdc / BigInt(2))
  const piece: Leg = { symbol: biggest.symbol, side: "buy", amount: { usdc: half } }
  return [...legs.filter((leg) => leg !== biggest), piece, {
    ...piece,
    amount: { usdc: Usdc.make(biggest.amount.usdc - half) }
  }]
}

/**
 * Adds a trade of `agent` waiting for your approval: one over its largest trade, or a plan of `legs` trades its
 * automation asks you about.
 */
export const addApproval = (
  world: MarketWorld,
  agent: CastAgent,
  legs: number,
  now: number
): ReadonlyArray<LiveEvent> => {
  const market = world.market
  if (legs <= 1) {
    const max = MAX_PER_TRADE[agent.preset]
    return addIntent(market, {
      agentId: agent.id,
      source: "assistant",
      leg: legOf(market, agent.stocks[0]!, "buy", max * 1.8),
      reason: `${nameOf(agent.stocks[0]!)} dipped after its results, so it wants to buy more than usual.`,
      status: "needsApproval",
      decision: { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(BigInt(max * 1_000_000)) },
      expiresAt: now + 24 * 60 * MINUTE,
      at: now
    }).events
  }

  const planned = planLegs(world, agent, legs, now)
  const batch = previewId("batch", nextNumber(market))
  const automationId = automationOfAgent(world.cast, agent)
  return waves(planned).flatMap((wave, index) =>
    wave.flatMap((leg) =>
      addIntent(market, {
        agentId: agent.id,
        source: automationId === null ? "assistant" : "automation",
        leg,
        reason: agent.template === "rebalancer" ? "Your mix drifted from its target." : "A plan across its stocks.",
        status: "needsApproval",
        decision: { _tag: "Ask" },
        batch: { id: batch, wave: index },
        expiresAt: now + 24 * 60 * MINUTE,
        at: now
      }, automationId).events
    )
  )
}
