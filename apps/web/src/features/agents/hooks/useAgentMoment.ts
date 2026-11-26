import type { Agent } from "@bluechip/domain/agents/Agent"
import { useAtom } from "@effect/atom-react/Hooks"
import { useEffect, useState } from "react"
import { agentMomentAtom } from "../atoms/moment.ts"
import { type AgentMoment, agentMoment, type AgentSnapshot, snapshotOf } from "../model/agentMoment.ts"

/**
 * The latest moment that landed for the live `agent` while its page is open (or that another page handed over), until
 * it's dismissed.
 */
export function useAgentMoment(agent: Agent): { moment: AgentMoment | null; dismiss: () => void } {
  const [handed, setHanded] = useAtom(agentMomentAtom)
  const [seen, setSeen] = useState<AgentSnapshot>(() => snapshotOf(agent))
  const [moment, setMoment] = useState<AgentMoment | null>(() =>
    handed !== null && handed.agentId === agent.id ? handed.moment : null
  )

  // Said once: a later visit to the page doesn't say it again.
  useEffect(() => {
    if (handed !== null && handed.agentId === agent.id) setHanded(null)
  }, [handed, agent.id, setHanded])

  const now = snapshotOf(agent)
  if (now.status !== seen.status || now.paused !== seen.paused || now.renewing !== seen.renewing) {
    setSeen(now)
    const landed = agentMoment(seen, now)
    if (landed !== null) setMoment(landed)
  }

  return {
    moment,
    dismiss: () => setMoment(null)
  }
}
