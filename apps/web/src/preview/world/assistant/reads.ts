// The read tools the assistant calls in the preview, with results its tool rows can sum up ("$178.42 a share",
// "3 agents", the help article): each encoded with the tool's own success schema, as the server stores them.
import type { Memory } from "@bluechip/domain/assistant/Memory"
import type { DocumentId } from "@bluechip/domain/Ids"
import { Citation, Passage } from "@bluechip/domain/knowledge/Knowledge"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { SpecCheck } from "@bluechip/domain/policies/Catalog"
import { templateInfos } from "@bluechip/domain/policies/Templates"
import { GetAgent, ListAgents } from "@bluechip/domain/tools/AgentTools"
import { SearchHelp } from "@bluechip/domain/tools/KnowledgeTools"
import { GetQuote } from "@bluechip/domain/tools/MarketTools"
import { ListMemories } from "@bluechip/domain/tools/MemoryTools"
import { CheckAgentSpec, ListTemplates } from "@bluechip/domain/tools/PolicyTools"
import type { CastAgent } from "../cast.ts"
import { agentOf, describe, quoteOf, usdc } from "./castRecords.ts"
import type { Mint } from "./mint.ts"
import { type Beat, read } from "./rounds.ts"

/** A help article's passage: its slug under `/help`, title, section and text. */
export type HelpPassage = readonly [slug: string, title: string, section: string, text: string]

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

export const listAgents = (mint: Mint): Beat =>
  read(mint, "listAgents", {}, ListAgents.successSchema, mint.cast.agents.map((agent) => agentOf(mint, agent)))

export const getAgent = (mint: Mint, agent: CastAgent): Beat => {
  const shown = agentOf(mint, agent)
  return read(mint, "getAgent", { agentId: agent.id }, GetAgent.successSchema, {
    agent: shown,
    description: describe(shown.spec)
  })
}

export const listTemplates = (mint: Mint): Beat =>
  read(mint, "listTemplates", {}, ListTemplates.successSchema, { builtIn: templateInfos(), saved: [] })

export const checkSpec = (mint: Mint, spec: AgentSpec): Beat =>
  read(
    mint,
    "checkAgentSpec",
    { spec: "draft" },
    CheckAgentSpec.successSchema,
    new SpecCheck({ problems: [], description: describe(spec), changes: null })
  )

export const listMemories = (mint: Mint, memories: ReadonlyArray<Memory>): Beat =>
  read(mint, "listMemories", {}, ListMemories.successSchema, memories)
