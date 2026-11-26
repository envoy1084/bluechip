import type { Card } from "@bluechip/domain/assistant/Card"
import { ChatCard } from "@bluechip/ui/bluechip/chat-card"
import { ChatNotice } from "@bluechip/ui/bluechip/chat-notice"
import { ResearchCard } from "@bluechip/ui/bluechip/research-card"
import type { IconName } from "@bluechip/ui/icons/icon"
import { ApprovalCard } from "./ApprovalCard.tsx"
import type { CardViews } from "./CardViews.ts"
import { AgentControlCard, MemoryCard, SaveTemplateCard } from "./ConfirmCards.tsx"
import { DraftAgentCard } from "./DraftAgentCard.tsx"
import { PolicyChangeCard } from "./PolicyChangeCard.tsx"

// Stopping early because you did (cancelled, or the connection to you dropped) is quiet; the rest is a warning.
const ERROR_LOOK: Readonly<
  Record<Extract<Card, { _tag: "Error" }>["reason"], { readonly icon: IconName; readonly quiet: boolean }>
> = {
  cancelled: { icon: "stop", quiet: true },
  interrupted: { icon: "bolt-off", quiet: true },
  budget: { icon: "warning", quiet: false },
  rounds: { icon: "warning", quiet: false },
  unavailable: { icon: "warning", quiet: false }
}

/** One card in the conversation, drawn for its kind. `onCard` takes the card as a confirm or dismiss left it. */
export function CardView(
  { card, onCard, Trade, nameOf }: Readonly<{ card: Card; onCard: (card: Card) => void } & CardViews>
) {
  switch (card._tag) {
    case "Trade":
      return (
        <ChatCard tag={card.intent.agentId === null ? "Your trade" : "Agent trade"} icon="agent" tone="quiet">
          <Trade intent={card.intent} nameOf={nameOf} />
        </ChatCard>
      )
    case "Approval":
      return <ApprovalCard card={card} Trade={Trade} nameOf={nameOf} />
    case "DraftAgent":
      return <DraftAgentCard card={card} />
    case "PolicyChange":
      return <PolicyChangeCard card={card} />
    case "AgentControl":
      return <AgentControlCard card={card} onCard={onCard} />
    case "SaveTemplate":
      return <SaveTemplateCard card={card} onCard={onCard} />
    case "Memory":
      return <MemoryCard card={card} onCard={onCard} />
    case "Research":
      return <ResearchCard query={card.query} citations={card.citations} />
    case "Error":
      return (
        <ChatNotice icon={ERROR_LOOK[card.reason].icon} quiet={ERROR_LOOK[card.reason].quiet}>
          {card.message}
        </ChatNotice>
      )
  }
}
