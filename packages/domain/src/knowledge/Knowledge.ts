/**
 * bluechip's own knowledge, for the assistant to answer from and cite: the help center's articles, and the facts of
 * each stock it lists (its token, its Chainlink feed and its pool).
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Address, DocumentId } from "../Ids.ts"
import { StockSymbol } from "../market/Market.ts"

/**
 * What a document is: a help article, or one stock's facts.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const DocumentKind = Schema.Literals(["help", "stock"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type DocumentKind = typeof DocumentKind.Type

/**
 * Where a passage comes from: its document, the section, and the link to cite.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Citation extends Schema.Class<Citation>("@bluechip/domain/knowledge/Knowledge/Citation")({
  documentId: DocumentId,
  kind: DocumentKind,
  title: Schema.String,
  section: Schema.NullOr(Schema.String),
  url: Schema.String
}) {}

/**
 * A passage found for a question, with its citation.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Passage extends Schema.Class<Passage>("@bluechip/domain/knowledge/Knowledge/Passage")({
  citation: Citation,
  text: Schema.String
}) {}

/**
 * A stock's facts onchain: its token, the Chainlink feed bluechip prices it with, its pool, and those facts in words.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class StockFacts extends Schema.Class<StockFacts>("@bluechip/domain/knowledge/Knowledge/StockFacts")({
  symbol: StockSymbol,
  name: Schema.String,
  token: Address,
  feed: Address,
  pool: Schema.NullOr(Schema.Struct({ address: Address, tickSpacing: Schema.Int })),
  facts: Schema.String,
  /** The token on Base's block explorer. */
  url: Schema.String
}) {}

/**
 * An article read from its Markdown: the `# Title`, then one section per `## Heading` (text before the first heading
 * is a section without one). Blank sections are left out.
 *
 * **Example** (Two sections)
 *
 * ```ts import.meta.vitest
 * import { parseArticle } from "@bluechip/domain/knowledge/Knowledge"
 *
 * parseArticle("# Gas\n\n## Who pays\n\nYou do.\n\n## Budget\n\nA cap a day.\n")
 * // => { title: "Gas", sections: [{ heading: "Who pays", text: "You do." }, { heading: "Budget", text: "A cap a day." }] }
 * ```
 *
 * @stability unstable
 * @category parsing
 * @since 0.0.0
 */
export const parseArticle = (markdown: string): {
  readonly title: string
  readonly sections: ReadonlyArray<{ readonly heading: string | null; readonly text: string }>
} => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const titleLine = lines.findIndex((line) => line.startsWith("# "))
  const title = titleLine === -1 ? "" : lines[titleLine]!.slice(2).trim()

  const sections: Array<{ heading: string | null; text: string }> = []
  let heading: string | null = null
  let body: Array<string> = []
  const close = () => {
    const text = body.join("\n").trim()
    if (text.length > 0) sections.push({ heading, text })
  }
  for (const line of lines.slice(titleLine + 1)) {
    if (!line.startsWith("## ")) {
      body.push(line)
      continue
    }
    close()
    heading = line.slice(3).trim()
    body = []
  }
  close()
  return { title, sections }
}

/**
 * A heading as a link's fragment: "Locking it with Face ID" is `locking-it-with-face-id`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const anchorOf = (heading: string): string =>
  heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")

/**
 * A stock's facts in words, from bluechip's stock list.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const describeStockFacts = (stock: {
  readonly symbol: string
  readonly name: string
  readonly token: string
  readonly feed: string
  readonly pool: { readonly address: string; readonly tickSpacing: number } | null
}): string =>
  [
    `${stock.name} (${stock.symbol}) is one of Coinbase's tokenized stocks on Base; its token is ${stock.token}.`,
    `bluechip prices it with Chainlink's NAV feed at ${stock.feed}, and checks every trade's price against it.`,
    stock.pool === null ?
      "It has no pool to trade in, so bluechip can't trade it." :
      `It trades in its USDC pool on Aerodrome's Slipstream at ${stock.pool.address} (tick spacing ` +
      `${stock.pool.tickSpacing}).`
  ].join(" ")
