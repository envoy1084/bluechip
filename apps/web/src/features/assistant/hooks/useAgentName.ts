import type { AgentId } from "@bluechip/domain/Ids"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"

/** Names an agent a result card mentions by id, once the agents list has it; "An agent" until then, "You" for `null`. */
export function useAgentName(): (agentId: AgentId | null) => string {
  const agents = useAtomValue(agentsAtom)
  return (agentId) => {
    if (agentId === null) return "You"
    const agent = AsyncResult.isSuccess(agents) ? agents.value.find((each) => each.id === agentId) : undefined
    return agent?.name ?? "An agent"
  }
}
