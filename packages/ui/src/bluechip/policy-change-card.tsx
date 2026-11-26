import type { ReactNode } from "react"
import { cn } from "../lib/cn.ts"
import { AgentAvatar } from "./agent-avatar.tsx"
import {
  ChatCard,
  ChatCardHeadline,
  ChatCardNote,
  ChatCardProblem,
  ChatCardRules,
  type ChatCardTone
} from "./chat-card.tsx"

export type PolicyChangeAction = "update" | "renew" | "remove"

/** How one rule changes: tighter, looser, new, removed or the same. */
export type RuleChange = "tighter" | "looser" | "added" | "removed" | "same"

const CHANGE: Readonly<Record<RuleChange, { readonly label: string; readonly tone: string }>> = {
  tighter: { label: "Tighter", tone: "text-gain" },
  added: { label: "New", tone: "text-gain" },
  looser: { label: "Looser", tone: "text-warn" },
  removed: { label: "Removed", tone: "text-warn" },
  same: { label: "Same", tone: "text-g-500" }
}

const TAG: Readonly<Record<PolicyChangeAction, string>> = {
  update: "New rules",
  renew: "Renewal",
  remove: "Removal"
}

/** A setting of a rule that changes: what it was and what it becomes (`null`: the rule is new, or goes). */
export interface PolicyFieldChange {
  readonly label: string
  readonly before: string | null
  readonly after: string | null
}

export interface PolicyRuleChange {
  readonly title: string
  readonly change: RuleChange
  /** The settings that change, before → after. */
  readonly fields?: ReadonlyArray<PolicyFieldChange>
}

const NONE: ReadonlyArray<string> = []
const NO_CHANGES: ReadonlyArray<PolicyRuleChange> = []

const fieldText = ({ after, before, label }: PolicyFieldChange): string =>
  before === null
    ? `${label}: ${after ?? ""}`
    : after === null
    ? `${label}: ${before}, gone`
    : `${label}: ${before} → ${after}`

export interface PolicyChangeCardProps {
  readonly action: PolicyChangeAction
  readonly agentId: string
  readonly name: string
  /** What signing does: "Locks the same rules with a new key for 90 more days." */
  readonly note: ReactNode
  /** An update's rules, each with how it changes and its settings before → after. */
  readonly changes?: ReadonlyArray<PolicyRuleChange>
  /** The update gives the agent more room than it has now. */
  readonly looser?: boolean
  /** Its limits at a glance after an update: an `AgentGlance`. */
  readonly glance?: ReactNode
  /** What the agent can and can never do after an update. */
  readonly can?: ReadonlyArray<string>
  readonly never?: ReadonlyArray<string>
  readonly state: ReactNode
  readonly tone?: ChatCardTone
  /** The Face ID button while it waits; the way to the agent after. */
  readonly footer: ReactNode
  readonly problem?: string | null
  /** In place of the details once it's sent, such as an `Outcome`. */
  readonly children?: ReactNode
}

/** A change of an agent's rules, its renewal or its removal, signed with Face ID right in the conversation. */
export function PolicyChangeCard(
  {
    action,
    agentId,
    name,
    note,
    changes = NO_CHANGES,
    looser = false,
    glance,
    can = NONE,
    never = NONE,
    state,
    tone = "waiting",
    footer,
    problem,
    children
  }: PolicyChangeCardProps
) {
  return (
    <ChatCard
      tag={TAG[action]}
      icon={action === "remove" ? "trash" : "shield"}
      state={state}
      tone={tone}
      footer={footer}
    >
      {children ?? (
        <>
          <ChatCardHeadline media={<AgentAvatar agentId={agentId} />} title={name} detail={note} />
          {changes.length === 0 ? null : (
            <ul className="grid divide-y divide-g-100 rounded-[12px] px-3 surface-well">
              {changes.map(({ change, fields = [], title }) => (
                <li key={title} className="grid gap-0.5 py-2 text-[13px]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-g-800">{title}</span>
                    <span className={cn("shrink-0 text-label-sm font-semibold", CHANGE[change].tone)}>
                      {CHANGE[change].label}
                    </span>
                  </span>
                  {fields.map((field) => (
                    <span key={field.label} className="text-caption text-g-500 tabular-nums">{fieldText(field)}</span>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {looser ?
            <ChatCardNote icon="warning" tone="warn">This gives the agent more room than it has now.</ChatCardNote> :
            null}
          {glance}
          <ChatCardRules can={can} never={never} />
        </>
      )}
      <ChatCardProblem>{problem}</ChatCardProblem>
    </ChatCard>
  )
}
