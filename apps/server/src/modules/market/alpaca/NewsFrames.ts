import * as Schema from "effect/Schema"

/** A news story as Alpaca reports it (Benzinga's feed), from its news stream or its news endpoint. */
export interface ShareNews {
  readonly id: string
  readonly headline: string
  readonly summary: string
  readonly url: string | null
  readonly symbols: ReadonlyArray<string>
  readonly publishedAt: string
}

/**
 * What one frame of the news stream says: stories, the stream refusing this account (bad keys, the connection limit
 * reached, news not in its plan: connecting again won't help), or another error (worth connecting again).
 */
export type NewsFrame =
  | { readonly _tag: "Story"; readonly story: ShareNews }
  | { readonly _tag: "Refused"; readonly code: number; readonly message: string }
  | { readonly _tag: "Failed"; readonly code: number; readonly message: string }

// Alpaca's stream errors that another connection with the same keys can't fix: auth failed (402), the connection
// limit (406), a feed not in the subscription (409).
const REFUSALS = new Set([402, 406, 409])

const Message = Schema.Union([
  Schema.Struct({
    T: Schema.Literal("n"),
    id: Schema.Number,
    headline: Schema.String,
    summary: Schema.String,
    url: Schema.NullishOr(Schema.String),
    symbols: Schema.Array(Schema.String),
    created_at: Schema.String
  }),
  Schema.Struct({ T: Schema.Literal("error"), code: Schema.Number, msg: Schema.String }),
  Schema.Struct({ T: Schema.String })
])

/**
 * Reads one frame of `wss://stream.data.alpaca.markets/v1beta1/news` (a JSON array of messages): its stories and
 * errors, leaving out connection, auth and subscription confirmations. Throws on a frame that isn't JSON of that shape.
 */
export const readNewsFrame = (text: string): ReadonlyArray<NewsFrame> =>
  Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(Message)))(text).flatMap((message): Array<NewsFrame> => {
    if (message.T === "n" && "headline" in message) {
      return [{
        _tag: "Story",
        story: {
          id: String(message.id),
          headline: message.headline,
          summary: message.summary,
          url: message.url ?? null,
          symbols: message.symbols,
          publishedAt: message.created_at
        }
      }]
    }
    if (message.T === "error" && "msg" in message) {
      return [{ _tag: REFUSALS.has(message.code) ? "Refused" : "Failed", code: message.code, message: message.msg }]
    }
    return []
  })
