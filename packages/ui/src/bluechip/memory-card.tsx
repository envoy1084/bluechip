import type { ReactNode } from "react"
import { ChatCard, ChatCardAnswer, ChatCardHeadline, ChatCardProblem, type ChatCardStatus } from "./chat-card.tsx"

export interface MemoryCardProps {
  /** What kind of memory: "Preference", "Rule", "Goal", "Fact". */
  readonly kind: string
  readonly text: string
  /** Where it came from, or why it matters. */
  readonly note?: string | null
  /** Saved or forgotten already, or one the assistant asks to keep. */
  readonly action: "saved" | "forgotten" | "confirm"
  readonly status: ChatCardStatus
  readonly busy: "confirm" | "dismiss" | null
  readonly problem?: string | null
  readonly onConfirm: () => void
  readonly onDismiss: () => void
  /** The way to everything bluechip remembers. */
  readonly link?: ReactNode
}

/** Something bluechip remembers about you, saved or forgotten, or one it asks to keep before it does. */
export function MemoryCard(
  { kind, text, note, action, status, busy, problem, onConfirm, onDismiss, link }: MemoryCardProps
) {
  const asking = action === "confirm" && status === "pending"
  const [state, tone] = action === "forgotten" ?
    ["Forgotten", "quiet"] as const :
    action === "saved" || status === "applied" ?
    ["Remembered", "done"] as const :
    status === "dismissed" ?
    ["Not kept", "quiet"] as const :
    ["Keep this?", "waiting"] as const

  return (
    <ChatCard
      tag={`Memory, ${kind.toLowerCase()}`}
      icon="book"
      state={state}
      tone={tone}
      footer={asking ?
        (
          <ChatCardAnswer
            busy={busy}
            confirmLabel="Remember"
            dismissLabel="Don't keep it"
            onConfirm={onConfirm}
            onDismiss={onDismiss}
          />
        ) :
        link}
    >
      <ChatCardHeadline title={text} detail={note ?? undefined} struck={action === "forgotten"} />
      <ChatCardProblem>{problem}</ChatCardProblem>
    </ChatCard>
  )
}
