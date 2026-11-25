import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { AGENT_TEMPLATES } from "@bluechip/ui/bluechip/template-picker"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentDot, agentState, hasSession } from "../../../../../agents/agentState.ts"
import { AgentStatePill } from "../../../../../agents/AgentStatePill.tsx"
import { lockedUntilLabel, uiTemplate } from "../../../../../agents/limits.ts"
import { agentUsageAtom } from "../../../../../atoms/agents.ts"

const dollars = (amount: bigint) => Number(amount) / 1_000_000

function Card({ agent, usage }: Readonly<{ agent: Agent; usage: AgentUsage | undefined }>) {
  const [now] = useState(() => new Date())
  const state = agentState(agent, now, usage)
  const template = AGENT_TEMPLATES.find((candidate) => candidate.name === uiTemplate(agent.template))

  return (
    <Link
      to="/agents/$agentId"
      params={{ agentId: agent.id }}
      className="grid content-start gap-3.5 rounded-lg bg-white p-[18px] shadow-e2 transition-shadow duration-fast ease-brand hover:shadow-e3 focus-visible:shadow-[var(--shadow-e2),0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <AgentAvatar agentId={agent.id} size="lg" status={agentDot(state)} />
        <span className="grid min-w-0 flex-1">
          <b className="truncate text-[15px] font-semibold tracking-[-0.01em]">{agent.name}</b>
          <span className="truncate text-label text-g-500">{template?.label}</span>
        </span>
        <AgentStatePill state={state} />
      </div>
      {usage !== undefined && agent.limits.dailyBudget > BigInt(0) ?
        (
          <UsageMeter
            used={dollars(usage.spentToday)}
            limit={dollars(agent.limits.dailyBudget)}
            resetsAt="midnight UTC"
          />
        ) :
        null}
      <span className="inline-flex items-center gap-1.5 text-label-sm text-g-500">
        <Icon name="lock" size={14} />
        {agent.lockedUntil === null ?
          "Not locked yet" :
          `Locked until ${lockedUntilLabel(DateTime.toDateUtc(agent.lockedUntil))}`}
      </span>
    </Link>
  )
}

function LockedCard({ agent }: Readonly<{ agent: Agent }>) {
  const usage = useAtomValue(agentUsageAtom(agent.id))
  return <Card agent={agent} usage={AsyncResult.isSuccess(usage) ? usage.value : undefined} />
}

/** One agent in the list: who it is, what it's doing, today's spend against its budget and when its lock ends. */
export function AgentListCard({ agent }: Readonly<{ agent: Agent }>) {
  return hasSession(agent) ? <LockedCard agent={agent} /> : <Card agent={agent} usage={undefined} />
}
