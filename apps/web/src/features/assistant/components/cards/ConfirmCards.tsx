// The cards bluechip applies when you confirm them: pausing or resuming agents, saving a template, keeping a memory.
import type { Card } from "@bluechip/domain/assistant/Card"
import { AgentControlCard as AgentControlView } from "@bluechip/ui/bluechip/agent-control-card"
import { MemoryCard as MemoryView } from "@bluechip/ui/bluechip/memory-card"
import { SaveTemplateCard as SaveTemplateView } from "@bluechip/ui/bluechip/save-template-card"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { useCardAnswer } from "../../hooks/useCardAnswer.ts"
import { MEMORY_KIND } from "../../model/cardText.ts"

type OnCard = (card: Card) => void

export function AgentControlCard(
  { card, onCard }: Readonly<{ card: Extract<Card, { _tag: "AgentControl" }>; onCard: OnCard }>
) {
  const answer = useCardAnswer(card, onCard)

  return (
    <AgentControlView
      action={card.action}
      agentName={card.agentName}
      status={card.status}
      busy={answer.busy}
      problem={answer.problem}
      onConfirm={answer.confirm}
      onDismiss={answer.dismiss}
    />
  )
}

export function SaveTemplateCard(
  { card, onCard }: Readonly<{ card: Extract<Card, { _tag: "SaveTemplate" }>; onCard: OnCard }>
) {
  const answer = useCardAnswer(card, onCard)

  return (
    <SaveTemplateView
      name={card.name}
      basedOn={card.basedOn}
      can={card.description.can}
      never={card.description.never}
      status={card.status}
      busy={answer.busy}
      problem={answer.problem}
      onConfirm={answer.confirm}
      onDismiss={answer.dismiss}
      next={
        <ButtonLink variant="secondary" render={<Link to="/agents/new" />}>
          Start an agent<Icon name="arrow-right" size={16} />
        </ButtonLink>
      }
    />
  )
}

export function MemoryCard({ card, onCard }: Readonly<{ card: Extract<Card, { _tag: "Memory" }>; onCard: OnCard }>) {
  const answer = useCardAnswer(card, onCard)

  return (
    <MemoryView
      kind={MEMORY_KIND[card.memory.kind]}
      text={card.memory.text}
      note={card.memory.note}
      action={card.action}
      status={card.status}
      busy={answer.busy}
      problem={answer.problem}
      onConfirm={answer.confirm}
      onDismiss={answer.dismiss}
      link={<ButtonLink variant="ghost" render={<Link to="/memory" />}>See what bluechip remembers</ButtonLink>}
    />
  )
}
