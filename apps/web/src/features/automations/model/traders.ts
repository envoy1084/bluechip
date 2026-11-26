// Who an automation trades through: one of your agents while it runs, or you, with Face ID each time.
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Stock } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { stocksFor } from "./drafts.ts"

/** Whether an agent can take new automations: locked onchain (or changing), not removed or run out. */
export const takesAutomations = (agent: Agent): boolean => agent.status === "active" || agent.status === "updating"

/** The policies its automations are checked against: the change on its way, or those in force. */
export const specOf = (agent: Agent): AgentSpec => agent.pendingSpec ?? agent.spec

/** The stocks an automation for `spec` can be about, from the stocks bluechip lists. */
export const stocksOf = (spec: AgentSpec | null, stocks: ReadonlyArray<Stock>): ReadonlyArray<Stock> => {
  const symbols = stocksFor(spec, stocks.map((stock) => stock.symbol))
  return stocks.filter((stock) => symbols.includes(stock.symbol))
}

/** "You, with Face ID for each trade", or the agent's name. */
export const traderName = (agent: Agent | null): string =>
  agent === null ? "You, with Face ID for each trade" : agent.name
