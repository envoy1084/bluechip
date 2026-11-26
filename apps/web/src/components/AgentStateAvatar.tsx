import type { Agent } from "@bluechip/domain/agents/Agent"
import { AgentAvatar, type AgentAvatarProps } from "@bluechip/ui/bluechip/agent-avatar"
import { useAgentState } from "../hooks/useAgentState.ts"
import { agentDot } from "../lib/agentState.ts"

/** An agent's butterfly with its state's dot, the same state its pill shows; no dot until that's known. */
export function AgentStateAvatar(
  { agent, ...props }: Readonly<{ agent: Agent } & Omit<AgentAvatarProps, "agentId" | "status">>
) {
  const state = useAgentState(agent)
  return <AgentAvatar agentId={agent.id} {...(state === undefined ? {} : { status: agentDot(state) })} {...props} />
}
