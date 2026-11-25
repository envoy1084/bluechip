import { cva } from "class-variance-authority"
import type { ComponentProps, ReactNode } from "react"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { AgentAvatar } from "./agent-avatar.tsx"

/** What happened: an agent's trade, a trade your limit stopped, a trade waiting for you, cash in, or the market. */
export type ActivityKind = "trade" | "blocked" | "approval" | "deposit" | "system"

export const activityItemVariants = cva(
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-g-100 px-4 py-3.5 last:border-b-0",
  {
    variants: {
      kind: {
        trade: "bg-white",
        blocked: "bg-[linear-gradient(180deg,#fff8f6,#fff3ef)] [&_[data-slot=activity-title]]:text-[#b3300f]",
        approval: "bg-[linear-gradient(180deg,#f8f9ff,#f3f5ff)]",
        deposit: "bg-white",
        system: "bg-white"
      }
    },
    defaultVariants: { kind: "trade" }
  }
)

const ICON_TILE: Readonly<Record<ActivityKind, string>> = {
  trade: "text-g-600",
  blocked: "text-loss",
  approval: "text-blue",
  deposit:
    "bg-[linear-gradient(180deg,#f3fcf6,#e6f7ec)] text-gain shadow-[inset_0_1px_0_#fff,0_0_0_1px_var(--color-gain-line)]",
  system: "text-[#5b4fd6]"
}

const DEFAULT_ICON: Readonly<Record<ActivityKind, IconName>> = {
  trade: "activity",
  blocked: "stop-sign",
  approval: "hand",
  deposit: "cash",
  system: "moon"
}

export interface ActivityItemProps extends Omit<ComponentProps<"li">, "title"> {
  readonly kind: ActivityKind
  /** The agent that did it: its butterfly leads the item. Without one, an icon does. */
  readonly agentId?: string
  readonly icon?: IconName
  readonly title: ReactNode
  /** When, already formatted: "9:41", "2 min ago", "Yesterday". */
  readonly time: ReactNode
  /** Buttons under the text, like "Review and approve". */
  readonly actions?: ReactNode
  /**
   * Opens its details from anywhere on the row; the title becomes its button for the keyboard, and `actions` stay
   * pressable on their own.
   */
  readonly onOpen?: () => void
}

/**
 * One thing that happened, for an activity list (`<ul>`), newest first. Blocked trades get a red wash so they're
 * never missed; trades waiting for you get a blue one.
 */
export function ActivityItem(
  { kind, agentId, icon, title, time, actions, onOpen, className, children, ...props }: ActivityItemProps
) {
  return (
    // The title is the keyboard's button; its click bubbles here, so a press anywhere on the row opens it once.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <li
      data-slot="activity-item"
      data-kind={kind}
      className={cn(
        activityItemVariants({ kind }),
        onOpen !== undefined &&
          "cursor-pointer transition-colors duration-fast ease-brand hover:bg-[#fafbfc] has-[[data-slot=activity-title]:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-blue)]",
        className
      )}
      onClick={onOpen}
      {...props}
    >
      {agentId === undefined ?
        (
          <span
            className={cn(
              "grid size-[34px] place-items-center rounded-[10px] bg-[linear-gradient(180deg,#fff,#f1f3f6)] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]",
              ICON_TILE[kind]
            )}
          >
            <Icon name={icon ?? DEFAULT_ICON[kind]} size={16} />
          </span>
        ) :
        <AgentAvatar agentId={agentId} />}
      <div className="grid min-w-0 gap-0.5">
        {onOpen === undefined ?
          <b data-slot="activity-title" className="text-body-sm font-semibold">{title}</b> :
          (
            <button
              type="button"
              data-slot="activity-title"
              className="text-left text-body-sm font-semibold outline-none"
            >
              {title}
            </button>
          )}
        {children && <span className="text-[13.5px] text-g-600">{children}</span>}
        {actions && (
          // Actions do their own thing, not open the details.
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div className="mt-2 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>{actions}</div>
        )}
      </div>
      <time className="pt-0.5 text-caption whitespace-nowrap text-g-500">{time}</time>
    </li>
  )
}
