// What a tool row shows once its tool is done: the answer in a few words ("$152.04", "3 agents", "Nvidia picker"),
// decoded from the tool's result with its own success schema. Tools whose answer is a card say nothing here; the card
// shows it.
import type { Stock } from "@bluechip/domain/market/Market"
import { GetAgent, GetAgentHistory, GetAgentJournal, ListAgents } from "@bluechip/domain/tools/AgentTools"
import { ListAutomations } from "@bluechip/domain/tools/AutomationTools"
import { GetStockFacts, SearchHelp } from "@bluechip/domain/tools/KnowledgeTools"
import { GetActivity, GetPortfolio, GetPrices, GetQuote, GetStock } from "@bluechip/domain/tools/MarketTools"
import { ListMemories, SearchMemory } from "@bluechip/domain/tools/MemoryTools"
import {
  GetAgentPerformance,
  GetAutomationPerformance,
  GetPerformance,
  GetStockPerformance
} from "@bluechip/domain/tools/PerformanceTools"
import { CheckAgentSpec, ListPolicies, ListTemplates } from "@bluechip/domain/tools/PolicyTools"
import { ProposeRebalance } from "@bluechip/domain/tools/TradeTools"
import { formatChange, formatMoney } from "@bluechip/ui/lib/format"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { priceDollars, usdcDollars } from "../../../lib/amounts.ts"

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

const stockPrice = (stock: Stock): string =>
  stock.price === null ? `${stock.name}, no price` : `${stock.name} ${formatMoney(priceDollars(stock.price.price))}`

// A tool's result is JSON as its success schema encodes it (amounts as strings, times as ISO dates).
const summarize =
  <S extends Schema.Codec<any, any, never, never>>(schema: S, say: (value: S["Type"]) => string) => (result: unknown) =>
    Option.getOrNull(Option.map(Schema.decodeUnknownOption(Schema.toCodecJson(schema))(result), say))

const SUMMARIES: Readonly<Record<string, (result: unknown) => string | null>> = {
  getPortfolio: summarize(GetPortfolio.successSchema, (portfolio) => formatMoney(usdcDollars(portfolio.value))),
  getPrices: summarize(
    GetPrices.successSchema,
    (stocks) =>
      stocks.length === 1
        ? stockPrice(stocks[0]!)
        : stocks.length === 0
        ? "No stocks"
        : count(stocks.length, "stock", "stocks")
  ),
  getStock: summarize(GetStock.successSchema, stockPrice),
  getQuote: summarize(GetQuote.successSchema, (quote) => `${formatMoney(priceDollars(quote.price))} a share`),
  getActivity: summarize(GetActivity.successSchema, (items) => {
    const trades = items.filter((item) => item._tag === "Trade").length
    const withdrawals = items.length - trades
    if (items.length === 0) return "Nothing yet"
    if (withdrawals === 0) return count(trades, "trade", "trades")
    if (trades === 0) return count(withdrawals, "withdrawal", "withdrawals")
    return `${count(trades, "trade", "trades")} and ${count(withdrawals, "withdrawal", "withdrawals")}`
  }),
  listAgents: summarize(
    ListAgents.successSchema,
    (agents) => agents.length === 0 ? "No agents yet" : count(agents.length, "agent", "agents")
  ),
  getAgent: summarize(GetAgent.successSchema, ({ agent }) => agent.name),
  getAgentHistory: summarize(
    GetAgentHistory.successSchema,
    ({ intents }) => intents.length === 0 ? "No trades yet" : count(intents.length, "trade", "trades")
  ),
  getAgentJournal: summarize(
    GetAgentJournal.successSchema,
    (entries) => entries.length === 0 ? "Nothing yet" : count(entries.length, "entry", "entries")
  ),
  listAutomations: summarize(
    ListAutomations.successSchema,
    (automations) => automations.length === 0 ? "None yet" : count(automations.length, "automation", "automations")
  ),
  listPolicies: summarize(
    ListPolicies.successSchema,
    (policies) => count(policies.filter((policy) => !policy.hidden).length, "policy", "policies")
  ),
  listTemplates: summarize(
    ListTemplates.successSchema,
    ({ builtIn, saved }) => count(builtIn.length + saved.length, "template", "templates")
  ),
  checkAgentSpec: summarize(
    CheckAgentSpec.successSchema,
    ({ problems }) => problems.length === 0 ? "No problems" : count(problems.length, "problem", "problems")
  ),
  listMemories: summarize(
    ListMemories.successSchema,
    (memories) => memories.length === 0 ? "Nothing yet" : count(memories.length, "memory", "memories")
  ),
  searchMemory: summarize(
    SearchMemory.successSchema,
    (hits) => hits.length === 0 ? "Nothing found" : count(hits.length, "thing", "things")
  ),
  searchHelp: summarize(SearchHelp.successSchema, (passages) => passages[0]?.citation.title ?? "Nothing found"),
  getPerformance: summarize(
    GetPerformance.successSchema,
    ({ realised, unrealised }) => `${formatChange(usdcDollars(realised + unrealised))} in all`
  ),
  getStockPerformance: summarize(
    GetStockPerformance.successSchema,
    ({ realised, unrealised }) => `${formatChange(usdcDollars(realised + unrealised))} in all`
  ),
  getAgentPerformance: summarize(
    GetAgentPerformance.successSchema,
    ({ realised, unrealised }) => `${formatChange(usdcDollars(realised + unrealised))} in all`
  ),
  getAutomationPerformance: summarize(
    GetAutomationPerformance.successSchema,
    ({ runs }) => count(runs, "run", "runs")
  ),
  getStockFacts: summarize(GetStockFacts.successSchema, (facts) => facts.name),
  proposeRebalance: summarize(
    ProposeRebalance.successSchema,
    (cards) => cards.length === 0 ? "Nothing to trade" : count(cards.length, "trade", "trades")
  )
}

/** The row's answer from the result a tool returned, or `null` when it has none to show (or it doesn't decode). */
export const toolSummary = (name: string, result: unknown): string | null => SUMMARIES[name]?.(result) ?? null
