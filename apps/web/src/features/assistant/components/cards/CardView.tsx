import type { Card } from "@bluechip/domain/assistant/Card"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { ApprovalCard } from "./ApprovalCard.tsx"
import { CardFrame } from "./CardFrame.tsx"
import type { CardViews } from "./CardViews.ts"
import { AgentControlCard, MemoryCard, SaveTemplateCard } from "./ConfirmCards.tsx"
import { DraftAgentCard } from "./DraftAgentCard.tsx"
import { PolicyChangeCard } from "./PolicyChangeCard.tsx"

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function ResearchCard({ card }: Readonly<{ card: Extract<Card, { _tag: "Research" }> }>) {
  return (
    <CardFrame tag="From the web" icon="globe" state="Not checked by bluechip">
      <p className="text-label-sm text-g-500">Searched for "{card.query}"</p>
      {card.citations.length === 0 ?
        <p className="text-[13.5px] text-g-700">No pages to cite.</p> :
        (
          <ol className="grid gap-2">
            {card.citations.filter((citation, index, all) => all.findIndex(({ url }) => url === citation.url) === index)
              .map((citation) => (
                <li key={citation.url} className="grid gap-0.5">
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-blue"
                  >
                    <span className="truncate">{citation.title || hostOf(citation.url)}</span>
                    <Icon name="external" size={12} className="shrink-0 text-g-400" />
                  </a>
                  <span className="text-label-sm text-g-500">{hostOf(citation.url)}</span>
                  {citation.citedText === null ?
                    null :
                    <q className="line-clamp-3 text-label-sm text-g-600">{citation.citedText}</q>}
                </li>
              ))}
          </ol>
        )}
    </CardFrame>
  )
}

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

function ErrorCard({ card }: Readonly<{ card: Extract<Card, { _tag: "Error" }> }>) {
  const look = ERROR_LOOK[card.reason]
  return (
    <p
      className={cn(
        "inline-flex items-start gap-1.5 justify-self-start rounded-[10px] py-2 pr-3 pl-2.5 text-[13.5px]",
        look.quiet ?
          "bg-g-50 text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-100)]" :
          "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
      )}
    >
      <Icon name={look.icon} size={14} className="mt-[3px] shrink-0" />
      {card.message}
    </p>
  )
}

/** One card in the conversation, drawn for its kind. `onCard` takes the card as a confirm or dismiss left it. */
export function CardView(
  { card, onCard, Trade, nameOf }: Readonly<{ card: Card; onCard: (card: Card) => void } & CardViews>
) {
  switch (card._tag) {
    case "Trade":
      return (
        <div className="w-full max-w-[560px] rounded-lg bg-white p-[18px] shadow-e2">
          <Trade intent={card.intent} nameOf={nameOf} />
        </div>
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
      return <ResearchCard card={card} />
    case "Error":
      return <ErrorCard card={card} />
  }
}
