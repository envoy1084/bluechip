import type { Card } from "@bluechip/domain/assistant/Card"
import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { ToolCallRow } from "@bluechip/ui/bluechip/tool-call-row"
import { useEffect, useRef } from "react"
import type { Entry } from "../model/thread.ts"
import { toolLabel } from "../model/toolLabel.ts"
import { CardView } from "./cards/CardView.tsx"
import type { CardViews } from "./cards/CardViews.ts"

/**
 * The conversation: your messages on the right; bluechip's turns on the left with what it checked (tool rows), its
 * answer as it streams, and the cards that came with it. The newest turn scrolls into view as it grows.
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
  const end = useRef<HTMLDivElement>(null)
  const last = entries.at(-1)
  // Changes whenever the thread grows: a new message, more text, another tool row or card.
  const growth = last?._tag === "Bluechip" ?
    `${entries.length} ${last.text.length} ${last.tools.length} ${last.cards.length}` :
    `${entries.length}`

  useEffect(() => {
    if (growth !== "0") end.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [growth])

  return (
    <div className="grid gap-5" aria-live="polite">
      {entries.map((entry) =>
        entry._tag === "You" ?
          <ChatMessage key={entry.id} from="you" text={entry.text} /> :
          (
            <ChatMessage
              key={entry.id}
              from="bluechip"
              text={entry.text}
              status={entry.status}
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
              attachments={entry.cards.length === 0 ? undefined : (
                <div className="grid gap-3 pt-1">
                  {entry.cards.map(({ card }) => (
                    <CardView key={card.id} card={card} onCard={onCard} Trade={Trade} nameOf={nameOf} />
                  ))}
                </div>
              )}
            />
          )
      )}
      <div ref={end} />
    </div>
  )
}
