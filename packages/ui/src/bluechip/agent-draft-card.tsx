import type { ReactNode } from "react"
import { AgentAvatar } from "./agent-avatar.tsx"
import { ChatCard, ChatCardHeadline, ChatCardProblem, ChatCardRules, type ChatCardTone } from "./chat-card.tsx"

export interface AgentDraftCardProps {
  /** The card's tag: "Draft agent" until it's locked, then "New agent". */
  readonly tag?: string
  /** The draft's id: its butterfly is the one it keeps. */
  readonly agentId: string
  readonly name: string
  /** One line under the name: "Runs for 90 days once locked. Pause it any time." */
  readonly detail: ReactNode
  readonly can: ReadonlyArray<string>
  readonly never: ReadonlyArray<string>
  /** Its limits at a glance, between the headline and its rules: an `AgentGlance`. */
  readonly glance?: ReactNode
  /** The most it could do on its worst day, under its rules: a quiet `WorstCaseCard`. */
  readonly worstCase?: ReactNode
  /** Where it stands: "Not running yet", "Running". */
  readonly state: ReactNode
  readonly tone?: ChatCardTone
  /** Customize and Lock with Face ID while it's a draft; the way to it once it runs. */
  readonly footer: ReactNode
  /** Why the lock didn't go. */
  readonly problem?: string | null
  /** In place of the rules once it's locked, such as an `Outcome`. */
  readonly children?: ReactNode
  /** What it comes with, under its rules (and under `children`): the automations its template starts once it's live. */
  readonly automations?: ReactNode
  readonly className?: string
}

/**
 * What chat hands you after "make an agent that…": the agent and its rules in sentences, then Customize or Lock with
 * Face ID. Nothing runs until it's locked.
 */
export function AgentDraftCard(
  {
    tag = "Draft agent",
    agentId,
    name,
    detail,
    can,
    never,
    glance,
    worstCase,
    state,
    tone = "waiting",
    footer,
    problem,
    children,
    automations,
    className
  }: AgentDraftCardProps
) {
  return (
    <ChatCard tag={tag} icon="agent" state={state} tone={tone} footer={footer} className={className}>
      {children ?? (
        <>
          <ChatCardHeadline media={<AgentAvatar agentId={agentId} size="lg" />} title={name} detail={detail} />
          {glance}
          <ChatCardRules can={can} never={never} />
          {worstCase}
        </>
      )}
      {automations}
      <ChatCardProblem>{problem}</ChatCardProblem>
    </ChatCard>
  )
}
