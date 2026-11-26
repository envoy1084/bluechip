// The panel's market actions: the market's session, prices and feeds, the account's cash and holdings, and agents'
// trades put in any state, each returning the live events the server would send.
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId } from "@bluechip/domain/Ids"
import type { Decision, IntentStatus, WaitReason } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { Transfer } from "@bluechip/domain/portfolio/Transfer"
import * as Result from "effect/Result"
import { defineAction } from "../../store.ts"
import { ACCOUNT_ADDRESS, castOf } from "../../world/cast.ts"
import { OWN_WALLET } from "../../world/market/history.ts"
import type { ApartSetting, FeedSetting, SessionSetting } from "../../world/market/model.ts"
import { changeOf, type DayMove, nameOf } from "../../world/market/prices.ts"
import { nextNumber, transferIdOf, txHashOf, utc } from "../../world/market/records.ts"
import { addApproval } from "../../world/market/signing.ts"
import {
  addIntent,
  advanceIntent,
  advanceTrade,
  agentOf,
  legOf,
  MAX_PER_TRADE,
  sendIntent
} from "../../world/market/trading.ts"
import { marketPriceOf, tickPrices } from "../../world/market/valuation.ts"
import type { World } from "../../world/World.ts"

const HOUR = 3_600_000

/** What a policy says when it refuses a trade, as the chain's rule bindings word it. */
export const REFUSALS: Readonly<
  Record<Exclude<PolicyId, "anyCall">, { readonly error: string | null; readonly message: (stock: string) => string }>
> = {
  trade: { error: "NotAllowed", message: (stock) => `It doesn't trade ${stock}.` },
  tradeSize: { error: "TooSmall", message: () => "Smaller than the smallest trade it makes." },
  fairPrice: { error: "UnfairPrice", message: () => "Too far from Chainlink's price." },
  stockCap: { error: "OverStockCap", message: (stock) => `Would put too much of your money in ${stock}.` },
  cashReserve: { error: "UnderCashReserve", message: () => "Would leave too little in cash." },
  rebalance: { error: "Overshoots", message: (stock) => `Would push ${stock} past its target.` },
  stopLossFloor: { error: "AboveFloor", message: (stock) => `Would sell ${stock} above the floor you set.` },
  slippageBudget: {
    error: "OverSlippageBudget",
    message: () => "Would lose more to prices than this week's budget allows."
  },
  tradesPerDay: { error: null, message: () => "It has made all of today's trades." },
  gasBudget: { error: null, message: () => "Would spend more on gas than today's budget allows." }
}

/** The outcomes the panel can give an agent's next trade. */
export type IntentOutcome =
  | "proposed"
  | "sending"
  | "confirming"
  | "filled"
  | "failed"
  | `wait:${WaitReason}`
  | `blocked:${keyof typeof REFUSALS}`

const CASH: Readonly<Record<"none" | "some" | "lots", number>> = { none: 0, some: 2_480, lots: 1_248_350.75 }

const HOLDINGS: Readonly<Record<"none" | "some" | "many", ReadonlyArray<readonly [StockSymbol, number]>>> = {
  none: [],
  some: castOf("typical").holdings.map((holding) => [holding.symbol, holding.shares]),
  many: [
    ...castOf("heavy").holdings.map((holding) => [holding.symbol, holding.shares] as const),
    ["INTC", 1_200],
    ["ANT", 3.5],
    ["CRCL", 40],
    ["SNDK", 15],
    ["SPCX", 2],
    ["MSTR", 0.0042]
  ]
}

const priceTick = (world: World, now: number): ReadonlyArray<LiveEvent> => {
  const prices = [...world.market.prices.keys()].flatMap((symbol) => {
    const price = marketPriceOf(world.market, symbol, now)
    return price === null ? [] : [price]
  })
  return [LiveEvent.cases.PriceTick.make({ prices })]
}

const moveCash = (world: World, dollars: number, now: number): ReadonlyArray<LiveEvent> => {
  const market = world.market
  const amount = BigInt(Math.round(dollars * 1_000_000))
  if (amount === BigInt(0)) return []

  market.cash += amount
  const deposit = amount > BigInt(0)
  const n = nextNumber(market)
  const transfer = new Transfer({
    id: transferIdOf(n),
    kind: deposit ? "deposit" : "withdrawal",
    asset: "USDC",
    amount: deposit ? amount : -amount,
    from: deposit ? OWN_WALLET : ACCOUNT_ADDRESS as Transfer["from"],
    to: deposit ? ACCOUNT_ADDRESS as Transfer["to"] : OWN_WALLET,
    status: "confirmed",
    txHash: txHashOf(90_000 + n),
    createdAt: utc(now)
  })
  market.transfers.push(transfer)
  return [LiveEvent.cases.TransferUpdated.make({ transfer }), LiveEvent.cases.PortfolioChanged.make({})]
}

export const setSession = defineAction("market.session", (world, session) => {
  world.market.session = session as SessionSetting
  world.market.feeds = session === "weekend" || session === "holiday" ? "paused" : "live"
  return priceTick(world, Date.now())
})

export const setFeeds = defineAction("market.feeds", (world, feeds) => {
  world.market.feeds = feeds as FeedSetting
})

export const setApart = defineAction("market.apart", (world, apart) => {
  world.market.apart = apart as ApartSetting
  return priceTick(world, Date.now())
})

export const setMove = defineAction("market.move", (world, move) => {
  const now = Date.now()
  world.market.move = move as DayMove
  for (const live of world.market.prices.values()) {
    live.price = live.previousClose * (1 + changeOf(live.symbol, move as DayMove))
    live.reference = live.price
    live.tradedAt = now
    live.referenceAt = now
  }
  return [...priceTick(world, now), LiveEvent.cases.PortfolioChanged.make({})]
})

export const setMissingPrice = defineAction("market.missingPrice", (world, missing) => {
  world.market.missingPrice = missing === true
})

export const setTicking = defineAction("market.ticking", (world, ticking) => {
  world.market.ticking = ticking === true
})

export const tickNow = defineAction("market.tick", (world) => tickPrices(world.market, Date.now()))

export const setCash = defineAction("market.cash", (world, level) => {
  const target = BigInt(Math.round(CASH[level as keyof typeof CASH] * 1_000_000))
  return moveCash(world, Number(target - world.market.cash) / 1_000_000, Date.now())
})

export const deposit = defineAction("market.deposit", (world, dollars) => moveCash(world, Number(dollars), Date.now()))

/** Sets the holdings to a preset: what changes shows in the ledger as shares found outside bluechip's trades. */
export const setHoldings = defineAction("market.holdings", (world, level) => {
  const market = world.market
  const now = Date.now()
  const wanted = new Map(
    HOLDINGS[level as keyof typeof HOLDINGS].map(([symbol, shares]) => [symbol, BigInt(Math.round(shares * 1e8))])
  )

  for (const symbol of new Set([...market.holdings.keys(), ...wanted.keys()])) {
    const shares = (wanted.get(symbol) ?? BigInt(0)) - (market.holdings.get(symbol) ?? BigInt(0))
    if (shares === BigInt(0)) continue
    market.adjustments.push({ symbol, shares, price: market.prices.get(symbol)!.price, at: now })
    market.holdings.set(symbol, wanted.get(symbol) ?? BigInt(0))
  }
  return [LiveEvent.cases.PortfolioChanged.make({})]
})

export const approval = defineAction("market.approval", (world, agentId, legs) => {
  const agent = agentOf(world, agentId as AgentId)
  return agent === undefined ? [] : addApproval(world, agent, Number(legs), Date.now())
})

/** Expires every trade waiting for you. */
export const expireApprovals = defineAction("market.expireApprovals", (world) => {
  const now = Date.now()
  const waiting = world.market.intents.filter(({ intent }) =>
    intent.status === "needsApproval" || intent.status === "awaitingSignature"
  )
  return waiting.flatMap(({ intent }) => {
    const moved = advanceIntent(world.market, intent.id, { _tag: "Expired" }, now)
    return Result.isSuccess(moved) ? moved.success.events : []
  })
})

const decisionOf = (outcome: IntentOutcome, stock: string, now: number): Decision | null => {
  if (outcome.startsWith("wait:")) {
    return { _tag: "Wait", reason: outcome.slice(5) as WaitReason, until: utc(now + HOUR) }
  }
  if (outcome.startsWith("blocked:")) {
    const policy = outcome.slice(8) as keyof typeof REFUSALS
    const refusal = REFUSALS[policy]
    return { _tag: "Refused", policy, error: refusal.error, stock: null, message: refusal.message(stock) }
  }
  return outcome === "proposed" ? null : { _tag: "Passes", callGasLimit: BigInt(412_000) }
}

const STATUS_OF: Readonly<Record<"proposed" | "wait" | "blocked", IntentStatus>> = {
  proposed: "proposed",
  wait: "waiting",
  blocked: "blocked"
}

/** Adds a trade of the agent in `outcome`: waiting for a reason, blocked by a policy, sent, filled or failed. */
export const agentIntent = defineAction("market.agentIntent", (world, agentId, outcome) => {
  const agent = agentOf(world, agentId as AgentId)
  if (agent === undefined) return []

  const now = Date.now()
  const market = world.market
  const symbol = agent.stocks[0]!
  const result = outcome as IntentOutcome
  const kind = result.split(":")[0] as keyof typeof STATUS_OF | "sending" | "confirming" | "filled" | "failed"
  const decision = decisionOf(result, nameOf(symbol), now)
  const leg = legOf(market, symbol, "buy", Math.min(120, MAX_PER_TRADE[agent.preset] / 2))

  if (kind === "proposed" || kind === "wait" || kind === "blocked") {
    return addIntent(market, {
      agentId: agent.id,
      source: "assistant",
      leg,
      reason: `A small buy of ${nameOf(symbol)}.`,
      status: STATUS_OF[kind],
      decision,
      expiresAt: kind === "wait" ? now + 6 * HOUR : null,
      at: now
    }).events
  }

  const created = addIntent(market, {
    agentId: agent.id,
    source: "assistant",
    leg,
    reason: `A small buy of ${nameOf(symbol)}.`,
    status: "deciding",
    decision: null,
    at: now
  })
  const sent = sendIntent(market, created.intent.id, { _tag: "Decided", decision: decision! }, now)
  const tradeId = sent.trade?.trade.id
  const events = [...created.events, ...sent.events]
  if (tradeId === undefined || kind === "sending") return events
  if (kind === "failed") return [...events, ...advanceTrade(market, tradeId, "failed", now)]
  return [
    ...events,
    ...advanceTrade(market, tradeId, "confirming", now),
    ...(kind === "filled" ? advanceTrade(market, tradeId, "filled", now) : [])
  ]
})

/** Moves the agent's latest trade on its way to `status`. */
export const advanceLatest = defineAction("market.advanceLatest", (world, agentId, status) => {
  const latest = world.market.trades.findLast(({ trade }) =>
    trade.agentId === agentId && (trade.status === "sending" || trade.status === "confirming")
  )
  return latest === undefined ?
    [] :
    advanceTrade(world.market, latest.trade.id, status as "confirming" | "filled" | "failed", Date.now())
})

/** Your own buy of `dollars` of `symbol`, filled at once. */
export const ownFill = defineAction("market.ownFill", (world, symbol, dollars) => {
  const now = Date.now()
  const market = world.market
  const leg = legOf(market, symbol as StockSymbol, "buy", Number(dollars))
  // Without the cash for it, the money arrives first, as a deposit.
  const shortfall = "usdc" in leg.amount && leg.amount.usdc > market.cash ? leg.amount.usdc - market.cash : BigInt(0)
  const funded = moveCash(world, Number(shortfall) / 1_000_000, now)

  const created = addIntent(market, {
    agentId: null,
    source: "owner",
    leg,
    status: "awaitingSignature",
    decision: null,
    at: now
  })
  const sent = sendIntent(market, created.intent.id, { _tag: "Signed" }, now)
  const tradeId = sent.trade?.trade.id
  return tradeId === undefined ?
    [] :
    [
      ...funded,
      ...created.events,
      ...sent.events,
      ...advanceTrade(market, tradeId, "confirming", now),
      ...advanceTrade(market, tradeId, "filled", now)
    ]
})

export const MARKET_ACTIONS = [
  setSession,
  setFeeds,
  setApart,
  setMove,
  setMissingPrice,
  setTicking,
  tickNow,
  setCash,
  deposit,
  setHoldings,
  approval,
  expireApprovals,
  agentIntent,
  advanceLatest,
  ownFill
].map((action) => action.def)
