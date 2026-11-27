import { Agent } from "@bluechip/domain/agents/Agent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useRef } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"

/**
 * An agent a card shows, as it stands now: its live record once the agents list has it, the card's copy until then.
 * The list leaves removed agents out, so one it listed that is gone from it has been removed.
 */
export function useLiveAgent(agent: Agent): Agent {
  const agents = useAtomValue(agentsAtom)
  const lastListed = useRef<Agent | undefined>(undefined)

  if (!AsyncResult.isSuccess(agents)) return lastListed.current ?? agent
  const listed = agents.value.find((each) => each.id === agent.id)
  if (listed !== undefined) {
    lastListed.current = listed
    return listed
  }
  return lastListed.current === undefined ? agent : new Agent({ ...lastListed.current, status: "removed" })
}
