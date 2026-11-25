import type { Agent } from "@bluechip/domain/agents/Agent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"

/** An agent a card shows, as it stands now: its live record once the agents list has it, the card's copy until then. */
export function useLiveAgent(agent: Agent): Agent {
  const agents = useAtomValue(agentsAtom)
  return (AsyncResult.isSuccess(agents) ? agents.value.find((each) => each.id === agent.id) : undefined) ?? agent
}
