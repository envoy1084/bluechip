import type { ComponentProps, ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/collapsible.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { AgentAvatar } from "./agent-avatar.tsx"

export interface BriefLine {
  readonly agentId: string
  readonly agentName: string
  /** What happened, after the agent's name: "Bought $50 of Microsoft, as planned every Monday." */
  readonly text: string
}

export interface DailyBriefCardProps extends Omit<ComponentProps<"div">, "children"> {
  /** The day it covers: "Tuesday 24 November". */
  readonly date: string
  readonly did: ReadonlyArray<BriefLine>
  readonly watching: ReadonlyArray<BriefLine>
  /** What your limits stopped. Refusals are a feature, so they get their own section. */
  readonly refused: ReadonlyArray<BriefLine>
  /** A tag beside the title, such as a status tag. */
  readonly flag?: ReactNode
}

const SECTIONS = [
  { key: "did", title: "What I did", icon: "check-circle", tone: "text-gain" },
  { key: "watching", title: "What I'm watching", icon: "eye", tone: "text-blue" },
  { key: "refused", title: "What I refused to do", icon: "shield", tone: "text-loss" }
] as const satisfies ReadonlyArray<{
  readonly key: "did" | "watching" | "refused"
  readonly title: string
  readonly icon: IconName
  readonly tone: string
}>

/** One card each morning from all your agents: what they did, what they're watching, and what they refused to do. */
export function DailyBriefCard({ date, did, watching, refused, flag, className, ...props }: DailyBriefCardProps) {
  const lines = { did, watching, refused }
  return (
    <div
      data-slot="daily-brief-card"
      className={cn("w-full overflow-hidden rounded-lg bg-white shadow-e2", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-2.5 px-[18px] pt-[18px] pb-3.5">
        <div className="grid">
          <span className="text-label-sm font-medium text-g-500">{date}</span>
          <h3 className="text-[19px] font-semibold tracking-[-0.02em]">Your daily brief</h3>
        </div>
        {flag}
      </div>
      {SECTIONS.map((section) => (
        <Collapsible
          key={section.key}
          defaultOpen
          className={cn(
            "border-t border-g-100",
            section.key === "refused" && "bg-[linear-gradient(180deg,#fffaf8,#fff)]"
          )}
        >
          <CollapsibleTrigger className="group/brief flex w-full cursor-pointer items-center gap-2 px-[18px] py-3 text-left hover:bg-g-50 focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)] focus-visible:outline-none">
            <Icon name={section.icon} size={16} className={section.tone} />
            <b className="text-body-sm font-semibold">{section.title}</b>
            <span className="rounded-full bg-g-100 px-[7px] text-label-sm font-semibold text-g-500 tabular-nums">
              {lines[section.key].length}
            </span>
            <Icon
              name="chevron-down"
              size={16}
              className="ml-auto text-g-400 transition-transform duration-base ease-brand group-not-data-panel-open/brief:-rotate-90"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="grid gap-2.5 px-[18px] pb-3.5">
              {lines[section.key].map((line) => (
                <li
                  key={`${line.agentId}:${line.text}`}
                  className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5 text-[13.5px] leading-normal text-g-700"
                >
                  <AgentAvatar agentId={line.agentId} size="sm" />
                  <span>
                    <b className="font-semibold text-ink">{line.agentName}</b> {line.text}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
