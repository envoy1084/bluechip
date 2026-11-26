import type { IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import type { AgentStatus as AvatarStatus } from "./agent-avatar.tsx"
import { StatusPill, type StatusPillProps, type StatusTone } from "./status-pill.tsx"

/**
 * What an agent is doing. Never "error": each state says what stopped it. `unlocked` is a draft whose limits aren't
 * locked yet; `sending` a lock, change or removal on its way to Base.
 */
export type AgentState =
  | "active"
  | "paused"
  | "needs-approval"
  | "stopped"
  | "expired"
  | "removed"
  | "unlocked"
  | "sending"

export interface AgentStateInfo {
  readonly label: string
  /** One sentence on what the state means for you. */
  readonly description: string
  /** The matching dot on the agent's avatar. */
  readonly dot: AvatarStatus
  readonly tone: StatusTone
  /** Its icon, so it reads without color too; an active agent has a dot instead. */
  readonly icon: IconName | undefined
}

export const AGENT_STATES: Readonly<Record<AgentState, AgentStateInfo>> = {
  active: {
    label: "Active",
    description: "Trading within its limits.",
    dot: "active",
    tone: "positive",
    icon: undefined
  },
  paused: {
    label: "Paused",
    description: "You paused it. It won't trade until you resume it.",
    dot: "paused",
    tone: "attention",
    icon: "pause"
  },
  "needs-approval": {
    label: "Needs your approval",
    description: "A trade is waiting for your approval.",
    dot: "waiting",
    tone: "pending",
    icon: "hand"
  },
  stopped: {
    label: "Done for today",
    description: "It used one of today's limits. It starts again at midnight UTC.",
    dot: "idle",
    tone: "neutral",
    icon: "clock"
  },
  expired: {
    label: "Ran out",
    description: "Its limits ran out. Renew them to keep it running.",
    dot: "idle",
    tone: "neutral",
    icon: "hourglass"
  },
  removed: {
    label: "Removed",
    description: "Removed for good. It can never trade again.",
    dot: "idle",
    tone: "neutral",
    icon: "trash"
  },
  unlocked: {
    label: "Not locked yet",
    description: "A draft. It can't trade until you lock its limits with Face ID.",
    dot: "idle",
    tone: "neutral",
    icon: "unlock"
  },
  sending: {
    label: "On its way",
    description: "Its limits are on their way to Base. It trades once they land.",
    dot: "waiting",
    tone: "pending",
    icon: "clock"
  }
}

export interface AgentStatusProps extends Omit<StatusPillProps, "tone" | "children" | "icon" | "dot"> {
  readonly state: AgentState
}

/**
 * One word for what an agent is doing, on the kit's status pill. A new state morphs the label in place; the first
 * one shows as it is.
 */
export function AgentStatus({ state, className, ...props }: AgentStatusProps) {
  const { label, tone, icon } = AGENT_STATES[state]
  return (
    <StatusPill
      data-slot="agent-status"
      data-state={state}
      tone={tone}
      morph
      dot={icon === undefined}
      {...(icon === undefined ? {} : { icon })}
      className={cn(state === "removed" && "line-through", className)}
      {...props}
    >
      {label}
    </StatusPill>
  )
}
