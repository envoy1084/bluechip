import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentUsageAtom } from "../../atoms/agents.ts"
import { useTemplateLabel } from "../../hooks/useTemplateLabel.ts"
import { agentDot, agentState, hasSession } from "../../model/agentState.ts"
import { dayLabel, toDollars } from "../../model/fieldText.ts"
import { AgentStatePill } from "../AgentStatePill.tsx"
import { RenewButton } from "../detail/RenewButton.tsx"

function Card({ agent, usage }: Readonly<{ agent: Agent; usage: AgentUsage | undefined }>) {
  const [now] = useState(() => new Date())
  const state = agentState(agent, now, usage)
  const templateLabel = useTemplateLabel(agent)
  const spent = usage?.policies.find((counted) => counted.policy === "trade")

  const lockLine = agent.lockedUntil === null ?
    "Not locked yet" :
    agent.status === "expired" ?
    `Ran out on ${dayLabel(agent.lockedUntil)}` :
    `Locked until ${dayLabel(agent.lockedUntil)}`

  // Renew sits outside the link: a button can't live inside one.
  return (
    <div className="grid content-start rounded-lg bg-white shadow-e2 transition-shadow duration-fast ease-brand has-[a:hover]:shadow-e3">
      <Link
        to="/agents/$agentId"
        params={{ agentId: agent.id }}
        className="grid content-start gap-3.5 rounded-lg p-[18px] focus-visible:shadow-[0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
      >
        <div className="flex items-center gap-3">
          <AgentAvatar agentId={agent.id} size="lg" status={agentDot(state)} />
          <span className="grid min-w-0 flex-1">
            <b className="truncate text-[15px] font-semibold tracking-[-0.01em]">{agent.name}</b>
            <span className="truncate text-label text-g-500">{templateLabel}</span>
          </span>
          <AgentStatePill state={state} />
        </div>
        {spent !== undefined && spent.limit !== null && spent.limit > BigInt(0) ?
          <UsageMeter used={toDollars(spent.used)} limit={toDollars(spent.limit)} resetsAt="midnight UTC" /> :
          null}
        <span className="inline-flex items-center gap-1.5 text-label-sm text-g-500">
          <Icon name={agent.status === "expired" ? "hourglass" : "lock"} size={14} />
          {lockLine}
        </span>
      </Link>
      {agent.status === "expired" ?
        (
          <div className="px-[18px] pb-[18px]">
            <RenewButton agent={agent} />
          </div>
        ) :
        null}
    </div>
  )
}

function LockedCard({ agent }: Readonly<{ agent: Agent }>) {
  const usage = useAtomValue(agentUsageAtom(agent.id))
  return <Card agent={agent} usage={AsyncResult.isSuccess(usage) ? usage.value : undefined} />
}

/**
 * One agent in the list: who it is, what it's doing, today's spend against its budget and when its lock ends, with
 * Renew once it ran out.
 */
export function AgentListCard({ agent }: Readonly<{ agent: Agent }>) {
  return hasSession(agent) ? <LockedCard agent={agent} /> : <Card agent={agent} usage={undefined} />
}
