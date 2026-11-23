import type { ComponentProps } from "react"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { type AgentLimits, limitRules } from "../lib/agent-limits.ts"
import { cn } from "../lib/cn.ts"
import { AgentAvatar } from "./agent-avatar.tsx"

export interface AgentDraftCardProps extends Omit<ComponentProps<"div">, "children"> {
  /** The draft agent's id: its butterfly is the one it will keep. */
  readonly agentId: string
  readonly name: string
  /** The template it was made from: "Rebalancer". */
  readonly template: string
  /** One line on what it will do: "Keeps you at 30 / 25 / 20 / 15, 10% cash". */
  readonly summary: string
  readonly limits: AgentLimits
  /** How long the lock will last: "Lasts 90 days, until 22 Feb." */
  readonly duration?: string
  /** `full` lists every rule; `inline` is one row inside a chat answer. */
  readonly variant?: "full" | "inline"
  /** Opens the review, where the limits are locked with Face ID. */
  readonly onReview?: () => void
  /** Shows an edit button on each rule. */
  readonly onEditRule?: (rule: string) => void
}

/**
 * What chat hands you after "create an agent that…": the agent, its rules in sentences, and one button to review
 * and lock it. Nothing runs until it's locked with Face ID.
 */
export function AgentDraftCard({
  agentId,
  name,
  template,
  summary,
  limits,
  duration = "Lasts 90 days. You can pause it any time.",
  variant = "full",
  onReview,
  onEditRule,
  className,
  ...props
}: AgentDraftCardProps) {
  if (variant === "inline") {
    return (
      <div
        data-slot="agent-draft-card"
        data-variant="inline"
        className={cn(
          "flex flex-wrap items-center gap-2.5 rounded-[12px] bg-white py-2.5 pr-2.5 pl-3 shadow-e2",
          className
        )}
        {...props}
      >
        <AgentAvatar agentId={agentId} />
        <span className="grid min-w-0 flex-1">
          <b className="text-[13.5px] font-semibold">{name}</b>
          <span className="text-label-sm text-g-500">Draft · {summary}</span>
        </span>
        <Button size="sm" onClick={onReview}>Review and lock</Button>
      </div>
    )
  }

  const { can, never } = limitRules(limits)
  const rules = [
    ...can.map((text) => ({ text, kind: "can" as const })),
    ...never.slice(0, 3).map((text) => ({
      text: `Never: ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
      kind: "never" as const
    }))
  ]
  return (
    <div
      data-slot="agent-draft-card"
      data-variant="full"
      className={cn("w-full overflow-hidden rounded-lg bg-white shadow-e2", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 border-b border-g-100 bg-[repeating-linear-gradient(135deg,#fafafb_0_8px,#f5f6f8_8px_16px)] px-[18px] py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
          <Icon name="edit" size={12} />Draft from chat
        </span>
        <span className="text-label-sm text-g-500">Not running yet</span>
      </div>
      <div className="flex items-center gap-3 px-[18px] pt-4 pb-1.5">
        <AgentAvatar agentId={agentId} size="lg" />
        <div className="grid min-w-0">
          <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{name}</h3>
          <span className="text-label text-g-500">{template} · {summary}</span>
        </div>
      </div>
      <ul className="grid py-1.5 pr-2.5 pl-[18px]">
        {rules.map((rule) => (
          <li
            key={rule.text}
            className="group/rule grid min-h-8 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-1.5 py-0.5 text-[13.5px] text-g-800"
          >
            <Icon
              name={rule.kind === "can" ? "check" : "close"}
              size={14}
              className={rule.kind === "can" ? "text-gain" : "text-loss"}
            />
            <span>{rule.text}</span>
            {onEditRule && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit: ${rule.text}`}
                onClick={() => onEditRule(rule.text)}
                className="opacity-50 group-hover/rule:opacity-100 focus-visible:opacity-100"
              >
                <Icon name="edit" size={14} />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-g-100 bg-[#fafafb] px-[18px] py-3.5">
        <span className="min-w-[180px] flex-1 text-label-sm text-g-500">{duration}</span>
        <Button onClick={onReview}>
          <Icon name="face-id" size={16} />Review and lock
        </Button>
      </div>
    </div>
  )
}
