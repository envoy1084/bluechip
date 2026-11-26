import type { Card } from "@bluechip/domain/assistant/Card"
import type { ChatInternalLink } from "@bluechip/ui/bluechip/chat-markdown"
import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { ToolCallRow } from "@bluechip/ui/bluechip/tool-call-row"
import { useNavigate } from "@tanstack/react-router"
import { type ResultCard, resultCardsOf } from "../model/resultCards.ts"
import { type BluechipTurn, type Entry, shownCards } from "../model/thread.ts"
import { toolLabel } from "../model/toolLabel.ts"
import { CardView } from "./cards/CardView.tsx"
import type { CardViews } from "./cards/CardViews.ts"
import { ResultCardView } from "./results/ResultCardView.tsx"

// A turn's result cards decode its tools' results; turns are replaced, never changed, so each is decoded once (while a
// reply streams, only the turn it adds to).
const decoded = new WeakMap<BluechipTurn, ReadonlyArray<ResultCard>>()

const resultsOf = (turn: BluechipTurn): ReadonlyArray<ResultCard> => {
  const known = decoded.get(turn)
  if (known !== undefined) return known
  const results = resultCardsOf(turn)
  decoded.set(turn, results)
  return results
}

/** A link in an answer to one of bluechip's pages (a help article, an agent), opened in place by the router. */
function RouterLink({ href, className, children }: Parameters<ChatInternalLink>[0]) {
  const navigate = useNavigate()
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        void navigate({ href })
      }}
    >
      {children}
    </a>
  )
}

const routerLink: ChatInternalLink = (link) => <RouterLink {...link} />

/**
 * The conversation: your messages on the right; bluechip's turns on the left with what it checked (tool rows), what
 * the reads found (result cards) and the cards that came with it, then its answer as it streams in under them.
 */
export function Thread(
  { entries, onCard, onRetry, Trade, nameOf }: Readonly<
    {
      entries: ReadonlyArray<Entry>
      onCard: (card: Card) => void
      /** Offered on the last turn when it ended in an error. */
      onRetry: () => void
    } & CardViews
  >
) {
  const last = entries.at(-1)

  return (
    <div className="grid gap-5">
      {entries.map((entry) => {
        if (entry._tag === "You") return <ChatMessage key={entry.id} from="you" text={entry.text} />
        const results = resultsOf(entry)
        const cards = shownCards(entry)

        return (
          <ChatMessage
            key={entry.id}
            from="bluechip"
            text={entry.text}
            status={entry.status}
            internalLink={routerLink}
            {...(entry.error === null ? {} : { error: entry.error })}
            {...(entry === last && entry.status === "error" ? { onRetry } : {})}
            toolCalls={entry.tools.length === 0 ? undefined : (
              <div className="flex flex-wrap gap-1.5">
                {entry.tools.map((row) => (
                  <ToolCallRow
                    key={row.id}
                    state={row.state}
                    label={toolLabel(row)}
                    {...(row.summary === null ? {} : { result: row.summary })}
                  />
                ))}
              </div>
            )}
            attachments={results.length === 0 && cards.length === 0 ? undefined : (
              <div className="grid gap-3">
                {results.map((result) => <ResultCardView key={result.id} card={result} nameOf={nameOf} />)}
                {cards.map(({ card }) => (
                  <CardView key={card.id} card={card} onCard={onCard} Trade={Trade} nameOf={nameOf} />
                ))}
              </div>
            )}
          />
        )
      })}
    </div>
  )
}
