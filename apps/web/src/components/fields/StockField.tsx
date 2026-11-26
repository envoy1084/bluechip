import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { TickerToggle } from "@bluechip/ui/bluechip/ticker-chip"
import { useId } from "react"

/** The stocks it may trade. Stocks without a pool can't be picked, unless it already trades them. */
export function StockField(
  { label, value, stocks, problem, onChange }: Readonly<{
    label: string
    value: ReadonlyArray<StockSymbol>
    stocks: ReadonlyArray<Stock>
    problem?: string | undefined
    onChange: (stocks: ReadonlyArray<StockSymbol>) => void
  }>
) {
  const id = useId()
  const pickable = stocks.filter((stock) => stock.tradable || value.includes(stock.symbol))

  const toggle = (symbol: StockSymbol, pressed: boolean) =>
    onChange(
      pickable
        .map((stock) => stock.symbol)
        .filter((candidate) => candidate === symbol ? pressed : value.includes(candidate))
    )

  return (
    <div className="grid gap-1.5">
      <span id={id} className="text-[13.5px] font-medium text-g-700">{label}</span>
      <fieldset aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {pickable.map((stock) => (
          <TickerToggle
            key={stock.symbol}
            symbol={stock.symbol}
            name={stock.name}
            pressed={value.includes(stock.symbol)}
            onPressedChange={(pressed) => toggle(stock.symbol, pressed)}
          />
        ))}
      </fieldset>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
