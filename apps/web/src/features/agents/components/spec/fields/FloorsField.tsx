import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { formatPrice } from "@bluechip/domain/policies/Format"
import type { Floor } from "@bluechip/domain/policies/StopLossFloor"
import { PriceField } from "../../../../../components/fields/PriceField.tsx"
import { withFloor } from "../../../model/floors.ts"

/**
 * A floor for each stock the agent trades: the price it has to fall to before the agent may sell it. A stock left
 * empty has no floor, which the policy says it needs.
 */
export function FloorsField(
  { label, value, symbols, stocks, nameOf, problem, onChange }: Readonly<{
    label: string
    value: ReadonlyArray<Floor>
    /** The stocks it trades, in order. */
    symbols: ReadonlyArray<StockSymbol>
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    problem?: string | undefined
    onChange: (floors: ReadonlyArray<Floor>) => void
  }>
) {
  const priceOf = (symbol: StockSymbol) => value.find((floor) => floor.symbol === symbol)?.price ?? null

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-[13.5px] font-medium text-g-700">{label}</legend>
      {symbols.map((symbol) => {
        const now = stocks.find((stock) => stock.symbol === symbol)?.price?.price
        return (
          <PriceField
            key={symbol}
            label={nameOf(symbol)}
            help={now === undefined ? undefined : `${nameOf(symbol)} is at ${formatPrice(now)} now.`}
            value={priceOf(symbol)}
            onChange={(price) => onChange(withFloor(value, symbols, symbol, price))}
          />
        )
      })}
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </fieldset>
  )
}
