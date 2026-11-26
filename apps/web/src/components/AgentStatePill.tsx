import type { Agent } from "@bluechip/domain/agents/Agent"
import { type AgentState, AgentStatus } from "@bluechip/ui/bluechip/agent-status"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAgentState } from "../hooks/useAgentState.ts"

/**
 * The agent's state in one word, or a placeholder while it loads (`undefined`): the pill appears with its real state,
 * and morphs only when that state changes later.
 */
export function AgentStatePill({ state }: Readonly<{ state: AgentState | undefined }>) {
  if (state === undefined) return <SkeletonBlock aria-hidden className="h-[22px] w-[72px] shrink-0 rounded-full" />
  return <AgentStatus state={state} />
}

/** The agent's state now, read for it: for places that have the agent and nothing else. */
export function AgentStateNow({ agent }: Readonly<{ agent: Agent }>) {
  return <AgentStatePill state={useAgentState(agent)} />
}
