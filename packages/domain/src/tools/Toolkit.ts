/**
 * bluechip's toolkit: every tool the model can use, the same on every surface (the web chat now, chat platforms and
 * MCP clients later). Handlers live in the server; research (Anthropic's web search) is added there, because the
 * provider runs it.
 *
 * @since 0.0.0
 */
import * as Toolkit from "effect/ai/Toolkit"
import {
  ChangeAgentPolicies,
  DraftAgent,
  ExplainDecision,
  GetAgent,
  GetAgentHistory,
  GetAgentUsage,
  ListAgents,
  PauseAgent,
  PauseAll,
  RemoveAgent,
  RenewAgent,
  ResumeAgent
} from "./AgentTools.ts"
import { CreateAutomation, ListAutomations, PauseAutomation } from "./AutomationTools.ts"
import { GetActivity, GetPortfolio, GetPrices, GetQuote, GetStock } from "./MarketTools.ts"
import { Forget, ListMemories, Remember } from "./MemoryTools.ts"
import { CheckAgentSpec, ListPolicies, ListTemplates, SaveTemplate } from "./PolicyTools.ts"
import { ProposeRebalance, ProposeTrade } from "./TradeTools.ts"

/**
 * @stability unstable
 * @category toolkits
 * @since 0.0.0
 */
export const BluechipToolkit = Toolkit.make(
  GetPortfolio,
  GetPrices,
  GetQuote,
  GetStock,
  GetActivity,
  ListAgents,
  GetAgent,
  GetAgentUsage,
  GetAgentHistory,
  ExplainDecision,
  ListPolicies,
  ListTemplates,
  CheckAgentSpec,
  ProposeTrade,
  ProposeRebalance,
  PauseAgent,
  ResumeAgent,
  PauseAll,
  SaveTemplate,
  DraftAgent,
  ChangeAgentPolicies,
  RenewAgent,
  RemoveAgent,
  Remember,
  Forget,
  ListMemories,
  ListAutomations,
  CreateAutomation,
  PauseAutomation
)

/**
 * The name the server gives Anthropic's web search tool in the toolkit it runs (`AnthropicTool.WebSearch_20250305`):
 * a `read` tool whose results are untrusted text.
 *
 * @stability unstable
 * @category toolkits
 * @since 0.0.0
 */
export const RESEARCH_TOOL = "AnthropicWebSearch"
