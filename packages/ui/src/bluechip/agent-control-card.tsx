import { ChatCard, ChatCardAnswer, ChatCardHeadline, ChatCardProblem, type ChatCardStatus } from "./chat-card.tsx"
import { Outcome } from "./outcome.tsx"

export type AgentControlAction = "pause" | "resume" | "pauseAll"

export interface AgentControlCardProps {
  readonly action: AgentControlAction
  /** The agent's name; `null` for every agent. */
  readonly agentName: string | null
  readonly status: ChatCardStatus
  readonly busy: "confirm" | "dismiss" | null
  /** Why confirming or dismissing didn't go. */
  readonly problem?: string | null
  readonly onConfirm: () => void
  readonly onDismiss: () => void
}

const ASK: Readonly<Record<AgentControlAction, (name: string) => readonly [string, string]>> = {
  pause: (name) => [`Pause ${name}`, "It stops trading right away. Nothing is sold."],
  resume: (name) => [`Resume ${name}`, "It trades again inside its rules."],
  pauseAll: () => ["Pause every agent", "They stop trading right away. Nothing is sold."]
}

const DONE: Readonly<Record<AgentControlAction, (name: string) => readonly [string, string]>> = {
  pause: (name) => [`${name} is paused`, "Resume it any time."],
  resume: (name) => [`${name} is trading again`, "It trades inside its rules."],
  pauseAll: () => ["Every agent is paused", "Resume each one any time."]
}

/** Pausing or resuming an agent (or every agent), asked in chat: done in place once you confirm. */
export function AgentControlCard(
  { action, agentName, status, busy, problem, onConfirm, onDismiss }: AgentControlCardProps
) {
  const name = agentName ?? "the agent"
  const [title, note] = ASK[action](name)
  const [doneTitle, doneNote] = DONE[action](agentName ?? "The agent")
  const resume = action === "resume"

  return (
    <ChatCard
      tag={resume ? "Resume" : "Pause"}
      icon={resume ? "play" : "pause"}
      state={status === "pending" ? "Waiting for you" : status === "applied" ? "Done" : "Not now"}
      tone={status === "pending" ? "waiting" : status === "applied" ? "done" : "quiet"}
      footer={status === "pending" ?
        <ChatCardAnswer busy={busy} confirmLabel={title} onConfirm={onConfirm} onDismiss={onDismiss} /> :
        undefined}
    >
      {status === "applied" ?
        <Outcome tone="success" title={doneTitle} description={doneNote} /> :
        <ChatCardHeadline title={title} detail={status === "dismissed" ? "You left it as it was." : note} />}
      <ChatCardProblem>{problem}</ChatCardProblem>
    </ChatCard>
  )
}
