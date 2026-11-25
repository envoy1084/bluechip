import type { Agent } from "@bluechip/domain/agents/Agent"
import { PermissionCard } from "@bluechip/ui/bluechip/permission-card"
import { useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { lockedUntilLabel, uiLimits } from "../../../../../agents/limits.ts"

function Heading({ children }: Readonly<{ children: string }>) {
  return <h3 className="px-0.5 text-label-sm font-semibold text-g-500">{children}</h3>
}

/** The limits in force (or, for a draft, the ones it will lock), and a change on its way to Base. */
export function LimitsSection({ agent }: Readonly<{ agent: Agent }>) {
  const navigate = useNavigate()
  const removed = agent.status === "removed"
  const lockedUntil = agent.lockedUntil === null || removed ?
    undefined :
    lockedUntilLabel(DateTime.toDateUtc(agent.lockedUntil))
  const editLimits = () => void navigate({ to: "/agents/$agentId/edit", params: { agentId: agent.id } })

  return (
    <section className="grid content-start gap-2.5">
      <Heading>
        {removed ? "The limits it had" : agent.status === "draft" ? "The limits it will lock" : "Its limits"}
      </Heading>
      <PermissionCard
        limits={uiLimits(agent.limits)}
        {...(lockedUntil === undefined ? {} : { lockedUntil })}
        {...(agent.status === "active" ? { onEditLimits: editLimits } : {})}
        removed={removed}
      />
      {agent.status === "updating" && agent.pendingLimits !== null ?
        (
          <>
            <Heading>The change on its way</Heading>
            <PermissionCard limits={uiLimits(agent.pendingLimits)} size="compact" />
          </>
        ) :
        null}
    </section>
  )
}
