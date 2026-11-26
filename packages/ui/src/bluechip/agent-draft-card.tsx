import type { ReactNode } from "react"
import { AgentAvatar } from "./agent-avatar.tsx"
import { ChatCard, ChatCardHeadline, ChatCardProblem, ChatCardRules, type ChatCardTone } from "./chat-card.tsx"

export interface AgentDraftCardProps {
  /** The draft's id: its butterfly is the one it keeps. */
  readonly agentId: string
  readonly name: string
  /** One line under the name: "Runs for 90 days once locked. Pause it any time." */
  readonly detail: ReactNode
  readonly can: ReadonlyArray<string>
  readonly never: ReadonlyArray<string>
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
  { agentId, name, detail, can, never, state, tone = "waiting", footer, problem, children, automations, className }:
    AgentDraftCardProps
) {
  return (
    <ChatCard tag="Draft agent" icon="agent" state={state} tone={tone} footer={footer} className={className}>
      {children ?? (
        <>
          <ChatCardHeadline media={<AgentAvatar agentId={agentId} size="lg" />} title={name} detail={detail} />
          <ChatCardRules can={can} never={never} />
        </>
      )}
      {automations}
      <ChatCardProblem>{problem}</ChatCardProblem>
    </ChatCard>
  )
}
