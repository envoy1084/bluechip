import type { Agent } from "@bluechip/domain/agents/Agent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentAtom } from "../atoms/agents.ts"

/** Where a sent lock or change of limits is: on its way to Base, landed, or failed (the agent is back where it was). */
type Landing = "sending" | "landed" | "failed"

/**
 * Follows a sent lock or change through the live agent until `landed` says it's done. The agent read before the
 * send can still be the one shown, so a failure counts only once the agent has been seen on its way (`locking` or
 * `updating`). Mount it once per send (a new `key`) so a retry starts fresh.
 */
export function useLanding(sent: Agent, landed: (agent: Agent) => boolean): { agent: Agent; landing: Landing } {
  const live = useAtomValue(agentAtom(sent.id))
  const agent = Option.getOrElse(AsyncResult.value(live), () => sent)
  const onItsWay = agent.status === "locking" || agent.status === "updating"
  const [seenOnItsWay, setSeenOnItsWay] = useState(false)
  if (onItsWay && !seenOnItsWay) setSeenOnItsWay(true)

  if (landed(agent)) return { agent, landing: "landed" }
  return { agent, landing: onItsWay || !seenOnItsWay ? "sending" : "failed" }
}
