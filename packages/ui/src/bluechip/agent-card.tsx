import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { type AgentLimits, formatDollars } from "../lib/agent-limits.ts"
import { cn } from "../lib/cn.ts"
import { AgentAvatar } from "./agent-avatar.tsx"
import { AGENT_STATES, type AgentState, AgentStatus } from "./agent-status.tsx"
import { PermissionCard } from "./permission-card.tsx"

export interface Agent {
  /** Stable id: the same id always hatches the same butterfly. */
  readonly id: string
  readonly name: string
  /** One line on what it does: "Keeps your mix on target". */
  readonly description: string
  readonly state: AgentState
  readonly limits: AgentLimits
  /** Dollars spent today. */
  readonly spentToday: number
  /** The day its Face ID lock runs out: "21 Feb". */
  readonly lockedUntil: string
}

export interface AgentCardProps extends Omit<ComponentProps<"div">, "children"> {
  readonly agent: Agent
  /** The last thing it did, with when: "Sold $73.61 of Nvidia · 9:41". */
  readonly lastAction?: string
  readonly onEditLimits?: () => void
}

/** An agent's full card for its page: who it is, its status, its last action and its permission card. */
export function AgentCard({ agent, lastAction, onEditLimits, className, ...props }: AgentCardProps) {
  return (
    <div
      data-slot="agent-card"
      className={cn("w-full overflow-hidden rounded-lg bg-white shadow-e2", className)}
      {...props}
    >
      <div className="flex items-center gap-3 px-[18px] py-4">
        <AgentAvatar agentId={agent.id} size="lg" removed={agent.state === "removed"} />
        <div className="grid min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{agent.name}</h3>
          <span className="truncate text-label text-g-500">{agent.description}</span>
        </div>
        <AgentStatus state={agent.state} />
      </div>
      {lastAction && (
        <p className="mx-[18px] mb-3 flex items-center gap-2 rounded-sm bg-g-50 px-2.5 py-[7px] text-label-sm text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-100)]">
          <Icon name="activity" size={14} className="text-g-400" />
          <span className="min-w-0 truncate">
            <span className="text-g-500">Last:</span> {lastAction}
          </span>
        </p>
      )}
      <PermissionCard
        limits={agent.limits}
        spentToday={agent.spentToday}
        lockedUntil={agent.lockedUntil}
        {...(onEditLimits ? { onEditLimits } : {})}
        className="rounded-none border-t border-g-100 shadow-none"
      />
    </div>
  )
}

export interface AgentRowProps extends Omit<ComponentProps<"button">, "children"> {
  readonly agent: Agent
  /** Marks the row as the open one in a list (`aria-pressed`). */
  readonly selected?: boolean
}

/** An agent's compact row for lists and the sidebar: avatar with status dot, name, line and today's use. */
export function AgentRow({ agent, selected, className, type = "button", ...props }: AgentRowProps) {
  const info = AGENT_STATES[agent.state]
  return (
    <button
      data-slot="agent-row"
      type={type}
      aria-pressed={selected}
      className={cn(
        "flex w-full cursor-pointer items-center gap-[11px] rounded-md px-2.5 py-2 text-left transition-[background,box-shadow] duration-fast ease-brand",
        "hover:bg-g-50 aria-pressed:bg-white aria-pressed:shadow-e2",
        className
      )}
      {...props}
    >
      <AgentAvatar agentId={agent.id} status={info.dot} removed={agent.state === "removed"} />
      <span className="grid min-w-0 flex-1">
        <b className="truncate text-[13.5px] font-semibold">{agent.name}</b>
        <span className="truncate text-label-sm text-g-500">
          <span className="sr-only">{info.label}.</span>
          {agent.description}
        </span>
      </span>
      {agent.limits.dailySpend > 0 ?
        (
          <span className="text-caption font-semibold whitespace-nowrap text-g-700 tabular-nums">
            {formatDollars(agent.spentToday)}
            <span className="font-medium text-g-400">/{formatDollars(agent.limits.dailySpend)}</span>
          </span>
        ) :
        <span className="text-caption font-semibold text-g-700">Waiting</span>}
    </button>
  )
}
