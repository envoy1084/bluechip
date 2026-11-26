// An automation's sentence in pieces, so a page can show its stocks as chips and its amounts in bold: "Every Monday at
// 10:00 New York time, buy **$50** of [AAPL] Apple."
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { StockSymbol } from "@bluechip/domain/market/Market"

export type SentencePart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "amount"; readonly text: string }
  | { readonly kind: "stock"; readonly text: string; readonly symbol: StockSymbol }

/** The stocks an automation's trigger, conditions and action name, in the order they first appear, each once. */
export const stocksIn = (automation: Pick<Automation, "trigger" | "conditions" | "action">): Array<StockSymbol> => {
  const found: Array<StockSymbol> = []
  const visit = (value: unknown, key: string): void => {
    if (typeof value === "string") {
      if ((key === "symbol" || key === "symbols") && !found.includes(value as StockSymbol)) {
        found.push(value as StockSymbol)
      }
      return
    }
    if (Array.isArray(value)) {
      for (const each of value) visit(each, key)
      return
    }
    if (typeof value === "object" && value !== null) {
      for (const [field, inner] of Object.entries(value)) visit(inner, field)
    }
  }
  visit([automation.trigger, ...automation.conditions, automation.action], "")
  return found
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const AMOUNT = String.raw`\$\d[\d,]*(?:\.\d+)?|\d+(?:\.\d+)?%`

/**
 * A sentence cut into text, amounts (`$50`, `$12.50`, `10%`) and the stocks it names, by name or by symbol. Longer
 * names win over shorter ones they contain, and a name only counts as a whole word.
 */
export const sentenceParts = (
  sentence: string,
  stocks: ReadonlyArray<{ readonly symbol: StockSymbol; readonly name: string }>
): Array<SentencePart> => {
  const bySpelling = new Map<string, StockSymbol>()
  for (const stock of stocks) {
    bySpelling.set(stock.name, stock.symbol)
    bySpelling.set(stock.symbol, stock.symbol)
  }
  const spellings = [...bySpelling.keys()].sort((a, b) => b.length - a.length).map(escape)
  const pattern = new RegExp(
    spellings.length === 0 ? `(${AMOUNT})` : `(${AMOUNT})|(?<![\\w])(${spellings.join("|")})(?![\\w])`,
    "g"
  )

  const parts: Array<SentencePart> = []
  let from = 0
  for (const match of sentence.matchAll(pattern)) {
    if (match.index > from) parts.push({ kind: "text", text: sentence.slice(from, match.index) })
    parts.push(
      match[1] === undefined ?
        { kind: "stock", text: match[0], symbol: bySpelling.get(match[0])! } :
        { kind: "amount", text: match[0] }
    )
    from = match.index + match[0].length
  }
  if (from < sentence.length) parts.push({ kind: "text", text: sentence.slice(from) })
  return parts
}
