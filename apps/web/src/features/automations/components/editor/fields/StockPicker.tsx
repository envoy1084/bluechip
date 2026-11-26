import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { useId } from "react"

/** One stock, picked from those it may be about. */
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

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span id={id} className="text-[13.5px] font-medium text-g-700">{label}</span>
        <Select items={items} value={value} onValueChange={(picked) => picked !== null && onChange(picked)}>
          <SelectTrigger size="sm" aria-labelledby={id} className="min-w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stocks.map((stock) => (
              <SelectItem key={stock.symbol} value={stock.symbol}>
                <TickerChip symbol={stock.symbol} size="sm" />
                {stock.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
