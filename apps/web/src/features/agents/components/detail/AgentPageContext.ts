import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type * as AsyncResult from "effect/reactivity/AsyncResult"
import { createContext, useContext } from "react"

/** What every tab of an agent's page reads: the agent, its usage (no session: none) and stock names. */
export interface AgentPage {
  readonly agent: Agent
  readonly usage: AsyncResult.AsyncResult<AgentUsage, unknown> | undefined
  readonly nameOf: (symbol: StockSymbol) => string
}

export const AgentPageContext = createContext<AgentPage | null>(null)

/** The agent whose page this is; the page's layout provides it once the agent has loaded. */
export const useAgentPage = (): AgentPage => {
  const page = useContext(AgentPageContext)
  if (page === null) throw new Error("useAgentPage is read outside an agent's page")
  return page
}
