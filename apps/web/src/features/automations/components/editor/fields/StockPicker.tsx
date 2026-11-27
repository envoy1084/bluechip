import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { formatPrice } from "@bluechip/domain/policies/Format"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { useId } from "react"
import { bpsPercent } from "../../../../../lib/amounts.ts"

/** A stock's chip and name, with its price and today's move after them when bluechip has them. */
function StockLine({ stock }: Readonly<{ stock: Stock }>) {
  return (
    <>
      <TickerChip symbol={stock.symbol} size="sm" />
      <span className="min-w-0 truncate font-medium text-ink">{stock.name}</span>
      {stock.price === null ?
        null :
        (
          <span className="ml-auto flex shrink-0 items-center gap-2 pl-2 text-label-sm text-g-600 tabular-nums">
            {formatPrice(stock.price.price)}
            {stock.change24h === null ? null : <PriceChange size="sm" value={bpsPercent(stock.change24h)} />}
          </span>
        )}
    </>
  )
}

/** One stock, picked from those it may be about, each with its price and today's move; its label above it. */
export function StockPicker(
  { label, value, stocks, problem, onChange }: Readonly<{
    label: string
    value: StockSymbol
    stocks: ReadonlyArray<Stock>
    problem?: string | undefined
    onChange: (symbol: StockSymbol) => void
  }>
) {
  const id = useId()
  const items = stocks.map((stock) => ({ value: stock.symbol, label: stock.name }))
  const picked = stocks.find((stock) => stock.symbol === value)

  return (
    <div className="grid content-start gap-1.5">
      <span id={id} className="text-[13.5px] font-medium text-g-700">{label}</span>
      <Select items={items} value={value} onValueChange={(next) => next !== null && onChange(next)}>
        <SelectTrigger aria-labelledby={id} aria-invalid={problem === undefined ? undefined : true} className="w-full">
          <SelectValue className="flex w-full">
            {picked === undefined ? value : <StockLine stock={picked} />}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-w-[min(360px,calc(100vw-16px))]">
          {stocks.map((stock) => (
            <SelectItem key={stock.symbol} value={stock.symbol} className="min-h-10">
              <StockLine stock={stock} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
