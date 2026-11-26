import type { Agent } from "@bluechip/domain/agents/Agent"
import { TEMPLATES } from "@bluechip/domain/policies/Templates"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { isPausable } from "../../../../hooks/usePauseAll.ts"
import { usePauseAgent } from "../../hooks/usePauseAgent.ts"
import { useTemplateLabel } from "../../hooks/useTemplateLabel.ts"
import { type AgentDisplayState, agentDot } from "../../model/agentState.ts"
import { dayLabel } from "../../model/fieldText.ts"
import { isTemplateId } from "../../model/templateLabel.ts"
import { AgentStatePill } from "../AgentStatePill.tsx"

/** "Rebalancer template, created 24 Aug, locked until 22 Feb"; "Custom, created 24 Aug" for one built from scratch. */
const summary = (agent: Agent, templateLabel: string): string =>
  [
    agent.template === null ? templateLabel : `${templateLabel} template`,
    `created ${dayLabel(agent.createdAt)}`,
    agent.lockedUntil === null || agent.status === "removed" ?
      null :
      agent.status === "expired" ?
      `ran out on ${dayLabel(agent.lockedUntil)}` :
      `locked until ${dayLabel(agent.lockedUntil)}`
  ].filter((part) => part !== null).join(", ")

/** Who the agent is and what it's doing (and, when done for today, why and until when), with Pause and Remove. */
export function AgentHeader(
  { agent, state, limit, onRemove }: Readonly<{
    agent: Agent
    state: AgentDisplayState
    /** Why it's done for today and when it starts again, while a limit stops it. */
    limit: string | null
    onRemove: () => void
  }>
) {
  const { busy, failed, pause } = usePauseAgent(agent)
  const templateLabel = useTemplateLabel(agent)
  const promise = agent.template !== null && isTemplateId(agent.template) ? TEMPLATES[agent.template].summary : null
  const removed = agent.status === "removed"
  const removable = agent.status === "draft" || agent.status === "active" || agent.status === "expired"

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-5 shadow-e2">
      <AgentAvatar agentId={agent.id} size="xl" status={agentDot(state)} removed={removed} />
      <div className="grid min-w-0 flex-[1_1_260px] gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="truncate text-[22px] font-semibold tracking-[-0.025em]">{agent.name}</h2>
          <AgentStatePill state={state} />
        </div>
        <span className="text-label-sm text-g-500">{summary(agent, templateLabel)}</span>
        {promise === null ? null : <span className="text-[13.5px] text-g-700">{promise}</span>}
        {state === "stopped" && limit !== null ? <span className="text-label-sm text-g-600">{limit}</span> : null}
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
