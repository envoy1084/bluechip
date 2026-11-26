// The cards bluechip applies when you confirm them: pausing or resuming agents, saving a template, keeping a memory.
import type { Card, CardStatus } from "@bluechip/domain/assistant/Card"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Link } from "@tanstack/react-router"
import { useCardAnswer } from "../../hooks/useCardAnswer.ts"
import { MEMORY_KIND } from "../../model/cardText.ts"
import { CardFrame, CardProblem, RuleList } from "./CardFrame.tsx"

const STATUS: Readonly<Record<CardStatus, string>> = {
  pending: "Waiting for you",
  applied: "Done",
  dismissed: "Dismissed"
}

function Answer(
  { answer, confirmLabel, dismissLabel = "Not now" }: Readonly<{
    answer: ReturnType<typeof useCardAnswer>
    confirmLabel: string
    dismissLabel?: string
  }>
) {
  return (
    <>
      <Button
        variant="ghost"
        loading={answer.busy === "dismiss"}
        disabled={answer.busy !== null}
        onClick={answer.dismiss}
      >
        {dismissLabel}
      </Button>
      <Button loading={answer.busy === "confirm"} disabled={answer.busy !== null} onClick={answer.confirm}>
        {confirmLabel}
      </Button>
    </>
  )
}

type OnCard = (card: Card) => void

const CONTROL: Readonly<
  Record<Extract<Card, { _tag: "AgentControl" }>["action"], (name: string | null) => readonly [string, string]>
> = {
  pause: (name) => [`Pause ${name ?? "the agent"}`, "It stops trading right away. Nothing is sold."],
  resume: (name) => [`Resume ${name ?? "the agent"}`, "It trades again inside its policies."],
  pauseAll: () => ["Pause every agent", "They stop trading right away. Nothing is sold."]
}

export function AgentControlCard(
  { card, onCard }: Readonly<{ card: Extract<Card, { _tag: "AgentControl" }>; onCard: OnCard }>
) {
  const answer = useCardAnswer(card, onCard)
  const [title, note] = CONTROL[card.action](card.agentName)

  return (
    <CardFrame
      tag={card.action === "resume" ? "Resume" : "Pause"}
      icon={card.action === "resume" ? "play" : "pause"}
      state={STATUS[card.status]}
      footer={card.status === "pending" ? <Answer answer={answer} confirmLabel={title} /> : undefined}
    >
      <div className="grid gap-0.5">
        <b className="text-[15px] font-semibold">{title}</b>
        <span className="text-label-sm text-g-500">
          {card.status === "applied" ?
            card.action === "resume" ? "Done. It's trading again." : "Done. Resume it any time." :
            card.status === "dismissed" ?
            "You left it as it was." :
            note}
        </span>
      </div>
      <CardProblem message={answer.problem} />
    </CardFrame>
  )
}

export function SaveTemplateCard(
  { card, onCard }: Readonly<{ card: Extract<Card, { _tag: "SaveTemplate" }>; onCard: OnCard }>
) {
  const answer = useCardAnswer(card, onCard)

  return (
    <CardFrame
      tag="Template"
      icon="layers"
      state={STATUS[card.status]}
      footer={card.status === "pending" ?
        <Answer answer={answer} confirmLabel="Save template" /> :
        card.status === "applied" ?
        <ButtonLink variant="secondary" render={<Link to="/agents/new" />}>Start an agent</ButtonLink> :
        undefined}
    >
      <div className="grid gap-0.5">
        <b className="text-[15px] font-semibold">{card.name}</b>
        <span className="text-label-sm text-g-500">
          {card.status === "applied" ?
            "Saved. It's in your templates when you make an agent." :
            card.basedOn === null ?
            "A set of policies to start agents from." :
            `Based on ${card.basedOn}.`}
        </span>
      </div>
      <RuleList can={card.description.can} never={card.description.never} />
      <CardProblem message={answer.problem} />
    </CardFrame>
  )
}

export function MemoryCard({ card, onCard }: Readonly<{ card: Extract<Card, { _tag: "Memory" }>; onCard: OnCard }>) {
  const answer = useCardAnswer(card, onCard)
  const asking = card.action === "confirm" && card.status === "pending"
  const state = card.action === "forgotten" ?
    "Forgotten" :
    card.action === "saved" ?
    "Remembered" :
    card.status === "applied" ?
    "Remembered" :
    card.status === "dismissed" ?
    "Not kept" :
    "Should I remember this?"

  return (
    <CardFrame
      tag={`Memory, ${MEMORY_KIND[card.memory.kind].toLowerCase()}`}
      icon="book"
      state={state}
      footer={asking ?
        <Answer answer={answer} confirmLabel="Remember" dismissLabel="Don't keep it" /> :
        (
          <ButtonLink variant="ghost" render={<Link to="/memory" />}>
            See what bluechip remembers
          </ButtonLink>
        )}
    >
      <p className={card.action === "forgotten" ? "text-[14px] text-g-500 line-through" : "text-[14px] text-ink"}>
        {card.memory.text}
      </p>
      {card.memory.note === null ? null : <span className="text-label-sm text-g-500">{card.memory.note}</span>}
      <CardProblem message={answer.problem} />
    </CardFrame>
  )
}
