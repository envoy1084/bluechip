import type { Agent } from "@bluechip/domain/agents/Agent"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { AGENT_TEMPLATES } from "@bluechip/ui/bluechip/template-picker"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import * as DateTime from "effect/DateTime"
import { type AgentDisplayState, agentDot, isPausable } from "../../../../../agents/agentState.ts"
import { AgentStatePill } from "../../../../../agents/AgentStatePill.tsx"
import { lockedUntilLabel, uiTemplate } from "../../../../../agents/limits.ts"
import { usePauseAgent } from "./usePauseAgent.ts"

const day = (date: DateTime.Utc) => lockedUntilLabel(DateTime.toDateUtc(date))

/** "Rebalancer template, created 24 Aug, limits until 22 Feb". */
const summary = (agent: Agent, templateLabel: string): string =>
  [
    `${templateLabel} template`,
    `created ${day(agent.createdAt)}`,
    agent.lockedUntil === null ? null : `limits until ${day(agent.lockedUntil)}`
  ].filter((part) => part !== null).join(", ")

/** Who the agent is and what it's doing, with Pause and Remove. */
export function AgentHeader(
  { agent, state, onRemove }: Readonly<{ agent: Agent; state: AgentDisplayState; onRemove: () => void }>
) {
  const { busy, failed, pause } = usePauseAgent(agent)
  const template = AGENT_TEMPLATES.find((candidate) => candidate.name === uiTemplate(agent.template))
  const removed = agent.status === "removed"
  const removable = agent.status === "draft" || agent.status === "active"

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-5 shadow-e2">
      <AgentAvatar agentId={agent.id} size="xl" status={agentDot(state)} removed={removed} />
      <div className="grid min-w-0 flex-[1_1_260px] gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="truncate text-[22px] font-semibold tracking-[-0.025em]">{agent.name}</h2>
          <AgentStatePill state={state} />
        </div>
        <span className="text-label-sm text-g-500">{summary(agent, template?.label ?? "Agent")}</span>
        {template === undefined ? null : <span className="text-[13.5px] text-g-700">{template.promise}</span>}
        {failed ? <p role="alert" className="text-label text-loss">We couldn't pause it just now. Try again.</p> : null}
      </div>
      {removed ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {isPausable(agent) && !agent.paused ?
            (
              <Button variant="secondary" size="sm" loading={busy} onClick={() => void pause()}>
                <Icon name="pause" size={14} />Pause
              </Button>
            ) :
            null}
          {removable ?
            (
              <Button
                variant="ghost"
                size="sm"
                className="text-loss hover:bg-loss-wash hover:text-loss"
                onClick={onRemove}
              >
                <Icon name="trash" size={14} />Remove
              </Button>
            ) :
            null}
        </div>
      )}
    </section>
  )
}
