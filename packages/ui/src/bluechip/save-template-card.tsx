import type { ReactNode } from "react"
import {
  ChatCard,
  ChatCardAnswer,
  ChatCardHeadline,
  ChatCardProblem,
  ChatCardRules,
  type ChatCardStatus
} from "./chat-card.tsx"
import { Outcome } from "./outcome.tsx"

export interface SaveTemplateCardProps {
  readonly name: string
  /** The template it's based on: "Stock picker". */
  readonly basedOn: string | null
  readonly can: ReadonlyArray<string>
  readonly never: ReadonlyArray<string>
  readonly status: ChatCardStatus
  readonly busy: "confirm" | "dismiss" | null
  readonly problem?: string | null
  readonly onConfirm: () => void
  readonly onDismiss: () => void
  /** Once saved, the way to use it: a "Start an agent" link. */
  readonly next?: ReactNode
}

/** A set of rules to keep as a template, saved when you confirm, then ready to start an agent from. */
export function SaveTemplateCard(
  { name, basedOn, can, never, status, busy, problem, onConfirm, onDismiss, next }: SaveTemplateCardProps
) {
  return (
    <ChatCard
      tag="Template"
      icon="layers"
      state={status === "pending" ? "Waiting for you" : status === "applied" ? "Saved" : "Not now"}
      tone={status === "pending" ? "waiting" : status === "applied" ? "done" : "quiet"}
      footer={status === "pending" ?
        <ChatCardAnswer busy={busy} confirmLabel="Save template" onConfirm={onConfirm} onDismiss={onDismiss} /> :
        status === "applied" && next !== undefined ?
        next :
        undefined}
    >
      {status === "applied" ?
        <Outcome tone="success" title={`${name} is saved`} description="It's in your templates for the next agent." /> :
        (
          <>
            <ChatCardHeadline
              title={name}
              detail={status === "dismissed" ?
                "Not saved." :
                basedOn === null ?
                "Rules to start agents from." :
                `Based on ${basedOn}.`}
            />
            {status === "pending" ? <ChatCardRules can={can} never={never} /> : null}
          </>
        )}
      <ChatCardProblem>{problem}</ChatCardProblem>
    </ChatCard>
  )
}
