import type { Card } from "@bluechip/domain/assistant/Card"
import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { ToolCallRow } from "@bluechip/ui/bluechip/tool-call-row"
import { type Entry, shownCards } from "../model/thread.ts"
import { toolLabel } from "../model/toolLabel.ts"
import { CardView } from "./cards/CardView.tsx"
import type { CardViews } from "./cards/CardViews.ts"

/**
 * The conversation: your messages on the right; bluechip's turns on the left with what it checked (tool rows), its
 * answer as it streams, and the cards that came with it.
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
              attachments={shownCards(entry).length === 0 ? undefined : (
                <div className="grid gap-3 pt-1">
                  {shownCards(entry).map(({ card }) => (
                    <CardView key={card.id} card={card} onCard={onCard} Trade={Trade} nameOf={nameOf} />
                  ))}
                </div>
              )}
            />
          )
      )}
    </div>
  )
}
