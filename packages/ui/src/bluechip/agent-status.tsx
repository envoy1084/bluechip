import { cva } from "class-variance-authority"
import type { ComponentProps } from "react"
import { TextMorph } from "../components/text-morph.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import type { AgentStatus as AvatarStatus } from "./agent-avatar.tsx"

/** What an agent is doing. Never "error": each state says what stopped it. */
export type AgentState = "active" | "paused" | "needs-approval" | "stopped" | "expired" | "removed"

export interface AgentStateInfo {
  readonly label: string
  /** One sentence on what the state means for you. */
  readonly description: string
  /** The matching dot on the agent's avatar. */
  readonly dot: AvatarStatus
}

export const AGENT_STATES: Readonly<Record<AgentState, AgentStateInfo>> = {
  active: { label: "Active", description: "Trading within its limits.", dot: "active" },
  paused: { label: "Paused", description: "You paused it. It won't trade until you resume it.", dot: "paused" },
  "needs-approval": {
    label: "Needs your approval",
    description: "A trade is waiting for your approval.",
    dot: "waiting"
  },
  stopped: {
    label: "Done for today",
    description: "It used one of today's limits. It starts again at midnight UTC.",
    dot: "idle"
  },
  expired: {
    label: "Expired",
    description: "Its limits ran out on 21 Feb. Renew them to keep it running.",
    dot: "idle"
  },
  removed: { label: "Removed", description: "Removed for good. It can never trade again.", dot: "idle" }
}

const STATE_ICON: Readonly<Record<AgentState, IconName | undefined>> = {
  active: undefined,
  paused: "pause",
  "needs-approval": "hand",
  stopped: "clock",
  expired: "hourglass",
  removed: "trash"
}

export const agentStatusVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full py-[3px] pr-[9px] pl-[7px] text-label-sm font-[550] whitespace-nowrap",
  {
    variants: {
      state: {
        active: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
        paused: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
        "needs-approval": "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]",
        stopped: "bg-g-50 text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]",
        expired: "bg-g-50 text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-200)]",
        removed: "bg-g-50 text-g-600 line-through shadow-[inset_0_0_0_1px_var(--color-g-200)]"
      }
    },
    defaultVariants: { state: "active" }
  }
)

export interface AgentStatusProps extends Omit<ComponentProps<"span">, "children"> {
  readonly state: AgentState
}

/**
 * One word for what an agent is doing. Each state has its own color and icon, so it reads without color too. A new
 * state morphs the label in place.
 */
export function AgentStatus({ state, className, ...props }: AgentStatusProps) {
  const icon = STATE_ICON[state]
  return (
    <span
      data-slot="agent-status"
      data-state={state}
      className={cn(agentStatusVariants({ state }), className)}
      {...props}
    >
      {icon ?
        <Icon name={icon} size={13} /> :
        (
          <i
            aria-hidden
            className="size-1.5 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_18%,transparent)]"
          />
        )}
      <TextMorph>{AGENT_STATES[state].label}</TextMorph>
    </span>
  )
}
