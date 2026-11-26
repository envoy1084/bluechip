import type { StockSymbol } from "@bluechip/domain/market/Market"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { cn } from "@bluechip/ui/lib/cn"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { sentenceParts } from "../model/sentence.ts"

/**
 * A sentence of an automation (what it does, what fired a run) with each stock it names behind its chip (the first
 * time; after that by name alone) and each amount in bold. `symbols` are the stocks it may name.
 */
export function AutomationSentence(
  { sentence, symbols, className }: Readonly<{
    sentence: string
    symbols: ReadonlyArray<StockSymbol>
    className?: string
  }>
) {
  const { nameOf } = useStockLookup()
  const parts = sentenceParts(sentence, symbols.map((symbol) => ({ symbol, name: nameOf(symbol) })))
  const chipped = new Set<StockSymbol>()

  return (
    <span className={cn("text-pretty", className)}>
      {parts.map((part, index) => {
        const key = `${index}:${part.text}`
        if (part.kind === "text") return <span key={key}>{part.text}</span>
        if (part.kind === "amount") {
          return <b key={key} className="font-semibold text-ink tabular-nums">{part.text}</b>
        }
        if (chipped.has(part.symbol)) return <b key={key} className="font-semibold text-ink">{part.text}</b>
        chipped.add(part.symbol)
        // A sentence that names the stock by its symbol shows the chip alone.
        if (part.text === part.symbol) {
          return <TickerChip key={key} symbol={part.symbol} size="sm" className="mx-px align-[0.12em]" />
        }
        return (
          <span key={key} className="whitespace-nowrap">
            <TickerChip aria-hidden symbol={part.symbol} size="sm" className="mr-1 ml-px align-[0.12em]" />
            <b className="font-semibold text-ink">{part.text}</b>
          </span>
        )
      })}
    </span>
  )
}
