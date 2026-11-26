import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { AgentGlance } from "@bluechip/ui/bluechip/agent-glance"
import { agentGlance } from "../../model/agentGlance.ts"

/** An agent's limits at a glance, from its policies: its stocks, which way it trades, and its three numbers. */
export function SpecGlance({ spec }: Readonly<{ spec: AgentSpec }>) {
  const glance = agentGlance(spec)
  return (
    <AgentGlance
      stocks={glance.stocks}
      {...(glance.direction === null ? {} : { direction: glance.direction })}
      stats={glance.stats}
    />
  )
}
