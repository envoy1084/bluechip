import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AgentId } from "@bluechip/domain/Ids"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { agentIdeas, agentRulesLine, type StartIdea, startIdeas } from "../model/startIdeas.ts"

/** Your agents that haven't been removed; empty until they load. */
const useAgents = (): ReadonlyArray<Agent> => {
  const agents = useAtomValue(agentsAtom)
  return AsyncResult.isSuccess(agents) ? agents.value.filter((agent) => agent.status !== "removed") : []
}

/** The ideas under the start screen's box: for the picked agent, or for where your account is. */
export function useStartIdeas(agentId: AgentId | null): ReadonlyArray<StartIdea> {
  const agents = useAgents()
  const portfolio = useAtomValue(portfolioAtom)
  const { nameOf } = useStockLookup()
  const picked = agents.find((agent) => agent.id === agentId)
  if (picked !== undefined) return agentIdeas(picked, nameOf)

  const held = AsyncResult.isSuccess(portfolio) ? portfolio.value : null
  return startIdeas({
    // Until the portfolio loads, assume money is there: the first-deposit ideas are only for an empty account.
    hasMoney: held === null || held.value > BigInt(0),
    holdsStocks: held !== null && held.holdings.length > 0,
    agents: agents.length
  })
}

/** The start screen's heading: what to ask, and, with an agent picked, that agent and its rules. */
export function ChatStartHeading({ agentId }: Readonly<{ agentId: AgentId | null }>) {
  const agents = useAgents()
  const { nameOf } = useStockLookup()
  const picked = agents.find((agent) => agent.id === agentId)

  if (picked !== undefined) {
    return (
      <>
        <h2 className="text-[28px] font-semibold tracking-[-0.035em] text-balance">{`Ask ${picked.name}`}</h2>
        <p className="max-w-[46ch] text-body-sm text-g-600">
          {`${agentRulesLine(picked, nameOf)} Trades you ask for here go through it.`}
        </p>
      </>
    )
  }

  return (
    <>
      <h2 className="text-[28px] font-semibold tracking-[-0.035em]">What should we do today?</h2>
      <p className="max-w-[46ch] text-body-sm text-g-600">
        {agents.length === 0 ?
          "Ask about your money, trade, or set up an agent." :
          "Ask about your money, trade, or set up an agent. Pick an agent in the box and its trades go through it."}
      </p>
    </>
  )
}
