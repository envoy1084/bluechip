// What a read tool answered, decoded with the tool's own success schema (as `toolSummary` does), so a result card
// draws domain values: a `Portfolio`, `Stock`s, an `Agent`. A failed call answers with the problem it ran into.
import { Card } from "@bluechip/domain/assistant/Card"
import {
  ExplainDecision,
  GetAgent,
  GetAgentHistory,
  GetAgentJournal,
  GetAgentUsage,
  ListAgents
} from "@bluechip/domain/tools/AgentTools"
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
import { ListPolicies, ListTemplates } from "@bluechip/domain/tools/PolicyTools"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const READS = {
  getPortfolio: GetPortfolio.successSchema,
  getPerformance: GetPerformance.successSchema,
  getStock: GetStock.successSchema,
  getStockFacts: GetStockFacts.successSchema,
  getStockPerformance: GetStockPerformance.successSchema,
  getPrices: GetPrices.successSchema,
  getQuote: GetQuote.successSchema,
  listAgents: ListAgents.successSchema,
  getAgent: GetAgent.successSchema,
  getAgentUsage: GetAgentUsage.successSchema,
  getAgentPerformance: GetAgentPerformance.successSchema,
  getAgentHistory: GetAgentHistory.successSchema,
  getAgentJournal: GetAgentJournal.successSchema,
  getActivity: GetActivity.successSchema,
  explainDecision: ExplainDecision.successSchema,
  listAutomations: ListAutomations.successSchema,
  getAutomationPerformance: GetAutomationPerformance.successSchema,
  listTemplates: ListTemplates.successSchema,
  listPolicies: ListPolicies.successSchema,
  listMemories: ListMemories.successSchema,
  searchMemory: SearchMemory.successSchema,
  searchHelp: SearchHelp.successSchema,
  // An action tool, read for the rebalance plan its cards make.
  proposeRebalance: Schema.Array(Card)
} as const

/** A tool that has a result card. */
export type ReadTool = keyof typeof READS

/** One read tool's answer, by the tool's name. */
export type ReadResult = { readonly [K in ReadTool]: { readonly tool: K; readonly value: (typeof READS)[K]["Type"] } }[
  ReadTool
]

/** The read result of one tool, by name. */
export type ReadOf<K extends ReadTool> = Extract<ReadResult, { readonly tool: K }>

export const isReadTool = (name: string): name is ReadTool => Object.hasOwn(READS, name)

/**
 * The answer of a read tool from the JSON it returned (amounts as strings, times as ISO dates), or `null` for a tool
 * without a result card or a result that doesn't decode.
 */
export const readResult = (name: string, result: unknown): ReadResult | null => {
  if (!isReadTool(name)) return null
  const schema: Schema.Codec<unknown, unknown, never, never> = READS[name]
  return Option.getOrNull(
    Option.map(
      Schema.decodeUnknownOption(Schema.toCodecJson(schema))(result),
      (value) => ({ tool: name, value }) as ReadResult
    )
  )
}

/** What a failed call said went wrong (its `ToolProblem`), or `null` when it said nothing readable. */
export const problemOf = (result: unknown): string | null =>
  Option.getOrNull(
    Option.map(
      Schema.decodeUnknownOption(Schema.Struct({ problem: Schema.String }))(result),
      ({ problem }) => problem
    )
  )
