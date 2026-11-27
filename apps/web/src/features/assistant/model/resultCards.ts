// The result cards a turn shows under its tool rows: one per read tool, compact, in the order the tools were called,
// shimmering while a tool runs and saying so when it failed or found nothing. A stock read several ways is one card;
// a portfolio read with the activity is the day's brief; a rebalance is one plan above its trades.
import { AgentId } from "@bluechip/domain/Ids"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockFacts } from "@bluechip/domain/knowledge/Knowledge"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { StockPerformance } from "@bluechip/domain/performance/Performance"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { type DailyBrief, dailyBrief, isQuietDay } from "./dailyBrief.ts"
import { isReadTool, problemOf, type ReadOf, type ReadResult, readResult, type ReadTool } from "./readResult.ts"
import { planLegs } from "./rebalancePlan.ts"
import type { BluechipTurn } from "./thread.ts"

/** Which card a tool's result is drawn as. */
type ResultKind =
  | "portfolio"
  | "performance"
  | "stock"
  | "prices"
  | "quote"
  | "agent"
  | "agents"
  | "usage"
  | "agentResults"
  | "activity"
  | "decision"
  | "automations"
  | "automationResults"
  | "templates"
  | "policies"
  | "memories"
  | "help"
  | "rebalance"
  | "brief"

const KIND: Readonly<Record<ReadTool, ResultKind>> = {
  getPortfolio: "portfolio",
  getPerformance: "performance",
  getStock: "stock",
  getStockFacts: "stock",
  getStockPerformance: "stock",
  getPrices: "prices",
  getQuote: "quote",
  getAgent: "agent",
  listAgents: "agents",
  getAgentUsage: "usage",
  getAgentPerformance: "agentResults",
  getActivity: "activity",
  getAgentHistory: "activity",
  getAgentJournal: "activity",
  explainDecision: "decision",
  listAutomations: "automations",
  getAutomationPerformance: "automationResults",
  listTemplates: "templates",
  listPolicies: "policies",
  listMemories: "memories",
  searchMemory: "memories",
  searchHelp: "help",
  proposeRebalance: "rebalance"
}

/** A stock as the turn read it: its price, its facts onchain and your results in it, whichever were read. */
export interface StockRead {
  readonly symbol: StockSymbol
  readonly stock: Stock | null
  readonly facts: StockFacts | null
  readonly performance: StockPerformance | null
}

export type ResultCard =
  | { readonly _tag: "Loading"; readonly id: string; readonly tool: ReadTool }
  | { readonly _tag: "Failed"; readonly id: string; readonly tool: ReadTool; readonly problem: string | null }
  | {
    readonly _tag: "Read"
    readonly id: string
    readonly read: ReadResult
    /** The agent it was asked about, for the way to its page when the result doesn't say. */
    readonly agentId: AgentId | null
  }
  | { readonly _tag: "Stock"; readonly id: string; readonly read: StockRead }
  | {
    readonly _tag: "Rebalance"
    readonly id: string
    readonly legs: ReadonlyArray<Intent>
    /** The portfolio the turn read, for the mix before and after; `null` when it read none. */
    readonly portfolio: Portfolio | null
  }
  | { readonly _tag: "Brief"; readonly id: string; readonly brief: DailyBrief }

/** Where a result card stands, as `ChatResult` draws it. */
export type ResultState = "loading" | "ready" | "empty" | "error"

export const resultKind = (card: ResultCard): ResultKind => {
  switch (card._tag) {
    case "Loading":
    case "Failed":
      return KIND[card.tool]
    case "Read":
      return KIND[card.read.tool]
    case "Stock":
      return "stock"
    case "Rebalance":
      return "rebalance"
    case "Brief":
      return "brief"
  }
}

/** Whether a read found nothing to show: no agents, no trades, a search with no hits. */
export const isEmptyRead = (read: ReadResult): boolean => {
  switch (read.tool) {
    case "getPortfolio":
      return read.value.holdings.length === 0 && read.value.cash === BigInt(0)
    case "getPerformance":
      return read.value.trades === 0 && read.value.stocks.length === 0
    case "getAgentUsage":
      return read.value.policies.length === 0
    case "getAgentPerformance":
      return read.value.trades === 0 && read.value.decided === 0
    case "getAgentHistory":
      return read.value.intents.length === 0
    case "getAutomationPerformance":
      return read.value.runs === 0
    case "listTemplates":
      return read.value.builtIn.length + read.value.saved.length === 0
    case "listPolicies":
      return read.value.every((policy) => policy.hidden)
    case "getPrices":
    case "listAgents":
    case "getActivity":
    case "getAgentJournal":
    case "listAutomations":
    case "listMemories":
    case "searchMemory":
    case "searchHelp":
    case "proposeRebalance":
      return read.value.length === 0
    default:
      return false
  }
}

export const resultState = (card: ResultCard): ResultState => {
  switch (card._tag) {
    case "Loading":
      return "loading"
    case "Failed":
      return "error"
    case "Read":
      return isEmptyRead(card.read) ? "empty" : "ready"
    case "Stock":
      return card.read.stock !== null && card.read.stock.price === null && card.read.performance === null ?
        "empty" :
        "ready"
    case "Rebalance":
      return card.legs.length === 0 ? "empty" : "ready"
    case "Brief":
      return isQuietDay(card.brief) ? "empty" : "ready"
  }
}

const agentIdOf = (params: unknown): AgentId | null =>
  Option.getOrNull(
    Option.map(Schema.decodeUnknownOption(Schema.Struct({ agentId: AgentId }))(params), ({ agentId }) => agentId)
  )

const symbolOf = (read: ReadOf<"getStock" | "getStockFacts" | "getStockPerformance">): StockSymbol => read.value.symbol

/** The result cards of `turn`, in the order its tools were called. */
export const resultCardsOf = (turn: BluechipTurn): ReadonlyArray<ResultCard> => {
  const done = turn.tools.flatMap((row) => {
    if (row.state !== "done") return []
    const read = readResult(row.name, row.result)
    return read === null ? [] : [{ id: row.id, read }]
  })
  const first = <K extends ReadTool>(tool: K) =>
    done.find((entry): entry is { id: string; read: ReadOf<K> } => entry.read.tool === tool)

  const portfolio = first("getPortfolio")
  const activity = first("getActivity")
  const waiting = [
    ...turn.cards.flatMap(({ card }) => card._tag === "Trade" || card._tag === "Approval" ? [card.intent] : []),
    ...done.flatMap(({ read }) => read.tool === "getAgentHistory" ? read.value.intents : [])
  ]
  const brief = portfolio === undefined || activity === undefined ?
    null :
    dailyBrief(portfolio.read.value, activity.read.value, waiting)

  const cards: Array<ResultCard> = []
  const stocks = new Map<StockSymbol, number>()
  for (const row of turn.tools) {
    if (!isReadTool(row.name)) continue
    if (row.state === "running") {
      cards.push({ _tag: "Loading", id: row.id, tool: row.name })
      continue
    }
    if (row.state === "failed") {
      cards.push({ _tag: "Failed", id: row.id, tool: row.name, problem: problemOf(row.result) })
      continue
    }

    const read = done.find((entry) => entry.id === row.id)?.read
    if (read === undefined) continue
    if (brief !== null && row.id === portfolio?.id) {
      cards.push({ _tag: "Brief", id: row.id, brief })
      continue
    }
    if (brief !== null && row.id === activity?.id) continue

    if (read.tool === "getStock" || read.tool === "getStockFacts" || read.tool === "getStockPerformance") {
      const symbol = symbolOf(read)
      const at = stocks.get(symbol)
      const earlier = at === undefined ? undefined : cards[at]
      const merged: StockRead = earlier?._tag === "Stock" ?
        earlier.read :
        { symbol, stock: null, facts: null, performance: null }
      const next: StockRead = read.tool === "getStock" ?
        { ...merged, stock: read.value } :
        read.tool === "getStockFacts" ?
        { ...merged, facts: read.value } :
        { ...merged, performance: read.value }
      if (at === undefined) {
        stocks.set(symbol, cards.length)
        cards.push({ _tag: "Stock", id: row.id, read: next })
      } else {
        cards[at] = { _tag: "Stock", id: earlier?.id ?? row.id, read: next }
      }
      continue
    }

    if (read.tool === "proposeRebalance") {
      cards.push({
        _tag: "Rebalance",
        id: row.id,
        legs: planLegs(read.value),
        portfolio: portfolio?.read.value ?? null
      })
      continue
    }

    cards.push({ _tag: "Read", id: row.id, read, agentId: agentIdOf(row.params) })
  }
  return cards
}
