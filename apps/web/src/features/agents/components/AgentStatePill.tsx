import { AgentStatus, agentStatusVariants } from "@bluechip/ui/bluechip/agent-status"
import { Icon } from "@bluechip/ui/icons/icon"
import type { AgentDisplayState } from "../model/agentState.ts"

/** The agent's state in one word: the kit's pill, or ours for a draft and for a change on its way to Base. */
export function AgentStatePill({ state }: Readonly<{ state: AgentDisplayState }>) {
  if (state === "unlocked") {
    return (
      <span data-slot="agent-status" className={agentStatusVariants({ state: "expired" })}>
        <Icon name="unlock" size={13} />Not locked yet
      </span>
    )
  }
  if (state === "sending") {
    return (
      <span data-slot="agent-status" className={agentStatusVariants({ state: "needs-approval" })}>
        <Icon name="clock" size={13} />On its way
      </span>
    )
  }
  return <AgentStatus state={state} />
}
