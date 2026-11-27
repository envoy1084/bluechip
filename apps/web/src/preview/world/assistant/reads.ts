// The read tools the assistant calls in the preview, with results its tool rows can sum up ("$178.42 a share",
// "3 agents", the help article): each encoded with the tool's own success schema, as the server stores them.
import { AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import type { Memory } from "@bluechip/domain/assistant/Memory"
import { RecallHit } from "@bluechip/domain/assistant/Recall"
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { DocumentId, JournalEntryId } from "@bluechip/domain/Ids"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { JournalEntry } from "@bluechip/domain/journal/Journal"
import { Citation, Passage } from "@bluechip/domain/knowledge/Knowledge"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import { catalogInfo, SpecCheck } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { templateInfos } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import {
  ExplainDecision,
  GetAgent,
  GetAgentHistory,
  GetAgentJournal,
  GetAgentUsage,
  ListAgents
} from "@bluechip/domain/tools/AgentTools"
import { ListAutomations } from "@bluechip/domain/tools/AutomationTools"
import { SearchHelp } from "@bluechip/domain/tools/KnowledgeTools"
import { GetQuote } from "@bluechip/domain/tools/MarketTools"
import { ListMemories, SearchMemory } from "@bluechip/domain/tools/MemoryTools"
import { CheckAgentSpec, ListPolicies, ListTemplates } from "@bluechip/domain/tools/PolicyTools"
import type { CastAgent } from "../cast.ts"
import { agentOf, describe, quoteOf, specOf, usdc } from "./castRecords.ts"
import type { Mint } from "./mint.ts"
import { type Beat, read } from "./rounds.ts"

/** A help article's passage: its slug under `/help`, title, section and text. */
type HelpPassage = readonly [slug: string, title: string, section: string, text: string]

export const searchHelp = (mint: Mint, query: string, passages: ReadonlyArray<HelpPassage>): Beat =>
  read(
    mint,
    "searchHelp",
    { query },
    SearchHelp.successSchema,
    passages.map(([slug, title, section, text]) =>
      new Passage({
        citation: new Citation({
          documentId: mint.id("document") as DocumentId,
          kind: "help",
          title,
          section,
          url: `/help/${slug}`
        }),
        text
      })
    )
  )

export const getQuote = (mint: Mint, symbol: StockSymbol, dollars: number): Beat =>
  read(
    mint,
    "getQuote",
    { symbol, side: "buy", dollars, shares: null },
    GetQuote.successSchema,
    quoteOf(mint, { symbol, side: "buy", amount: { usdc: usdc(dollars) } })
  )

/** Your agents; `none` for an account without any yet. */
export const listAgents = (mint: Mint, none = false): Beat =>
  read(
    mint,
    "listAgents",
    {},
    ListAgents.successSchema,
    none ? [] : mint.cast.agents.map((agent) => agentOf(mint, agent))
  )

/**
 * What an agent's policies counted today against its own limits: most of its budget and a few of its trades (its row
 * says only that it checked); `none` for an agent with nothing counted.
 */
export const getAgentUsage = (mint: Mint, agent: CastAgent, none = false): Beat => {
  const spec = specOf(agent)
  const budget = configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0)
  const count = configOf(spec.policies, tradesPerDay)?.count ?? null
  return read(
    mint,
    "getAgentUsage",
    { agentId: agent.id },
    GetAgentUsage.successSchema,
    new AgentUsage({
      policies: none ? [] : [
        ...(budget === BigInt(0) ?
          [] :
          [new PolicyUsage({ policy: "trade", unit: "usd", used: budget * BigInt(72) / BigInt(100), limit: budget })]),
        new PolicyUsage({
          policy: "tradesPerDay",
          unit: "count",
          used: BigInt(4),
          limit: count === null ? null : BigInt(count)
        }),
        new PolicyUsage({ policy: "slippageBudget", unit: "usd", used: BigInt(1_380_000), limit: BigInt(20_000_000) })
      ]
    })
  )
}

/** An agent's trades (none: "No trades yet"). */
export const getAgentHistory = (mint: Mint, agent: CastAgent, intents: ReadonlyArray<Intent>): Beat =>
  read(mint, "getAgentHistory", { agentId: agent.id }, GetAgentHistory.successSchema, { sessions: [], intents })

/** An agent's journal, newest first, an hour apart (none: "Nothing yet"). */
export const getAgentJournal = (mint: Mint, agent: CastAgent, entries: ReadonlyArray<string> = []): Beat =>
  read(
    mint,
    "getAgentJournal",
    { agentId: agent.id, limit: null },
    GetAgentJournal.successSchema,
    entries.map((entry, index) =>
      new JournalEntry({
        id: mint.id("journal") as JournalEntryId,
        agentId: agent.id,
        at: mint.at(1 + index),
        kind: "intent",
        entry,
        refs: {}
      })
    )
  )

/** Why a trade was decided as it was (its row says only that it looked). */
export const explainDecision = (mint: Mint, intent: Intent, explanation: string): Beat =>
  read(mint, "explainDecision", { intentId: intent.id }, ExplainDecision.successSchema, { intent, explanation })

export const listPolicies = (mint: Mint): Beat =>
  read(mint, "listPolicies", {}, ListPolicies.successSchema, catalogInfo())

/** Your automations (this tool's row has no summary of its own). */
export const listAutomations = (mint: Mint, automations: ReadonlyArray<Automation>): Beat =>
  read(mint, "listAutomations", {}, ListAutomations.successSchema, automations)

export const getAgent = (mint: Mint, agent: CastAgent): Beat => {
  const shown = agentOf(mint, agent)
  return read(mint, "getAgent", { agentId: agent.id }, GetAgent.successSchema, {
    agent: shown,
    description: describe(shown.spec)
  })
}

export const listTemplates = (mint: Mint): Beat =>
  read(mint, "listTemplates", {}, ListTemplates.successSchema, { builtIn: templateInfos(), saved: [] })

/** `params`: what the model sent, a whole spec at its longest; `problems`: why it can't be locked. */
export const checkSpec = (
  mint: Mint,
  spec: AgentSpec,
  params: unknown = { spec: "draft" },
  problems: ReadonlyArray<PolicyProblem> = []
): Beat =>
  read(
    mint,
    "checkAgentSpec",
    params,
    CheckAgentSpec.successSchema,
    new SpecCheck({ problems, description: describe(spec), changes: null })
  )

/** What a search of memory and past conversations recalled. */
export const searchMemory = (mint: Mint, query: string, memories: ReadonlyArray<Memory>): Beat =>
  read(
    mint,
    "searchMemory",
    { query },
    SearchMemory.successSchema,
    memories.map((memory, index) =>
      new RecallHit({
        kind: "memory",
        sourceId: memory.id,
        agentId: memory.agentId,
        text: memory.text,
        at: memory.createdAt,
        score: 1 / (index + 2)
      })
    )
  )

export const listMemories = (mint: Mint, memories: ReadonlyArray<Memory>): Beat =>
  read(mint, "listMemories", {}, ListMemories.successSchema, memories)
