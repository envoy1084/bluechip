import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { formatPrice } from "@bluechip/domain/policies/Format"
import type { Floor } from "@bluechip/domain/policies/StopLossFloor"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { cn } from "@bluechip/ui/lib/cn"
import { useState } from "react"
import { withFloor } from "../../../model/floors.ts"

const PRICE_SCALE = 100_000_000
const QUICK_DROPS = [5, 10, 20] as const

const priceText = (price: bigint | null): string =>
  price === null || price === BigInt(0) ? "" : String(Number(price) / PRICE_SCALE)

/** The floor `percent` under today's price, rounded to the cent. */
const under = (now: bigint, percent: number) =>
  Price.make(BigInt(Math.round((Number(now) * (100 - percent)) / 100 / 1_000_000)) * BigInt(1_000_000))

/** How far the floor sits under today's price, said the way it matters. */
function FloorGap({ floor, now }: Readonly<{ floor: bigint; now: bigint }>) {
  if (floor >= now) {
    return <span className="font-medium text-warn">At or above today's price, so it may sell now</span>
  }
  const gap = ((Number(now) - Number(floor)) / Number(now)) * 100
  return <span>{gap.toFixed(gap < 10 ? 1 : 0)}% under today's price</span>
}

function FloorRow(
  { symbol, name, now, floor, onChange }: Readonly<{
    symbol: StockSymbol
    name: string
    now: bigint | undefined
    floor: bigint | null
    onChange: (price: Price | null) => void
  }>
) {
  const [text, setText] = useState<string | null>(null)

  return (
    <div className="grid gap-2.5 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <TickerChip symbol={symbol} size="sm" />
          <span className="grid min-w-0">
            <b className="truncate text-[13.5px] font-semibold">{name}</b>
            <span className="text-label-sm text-g-500 tabular-nums">
              {now === undefined ? "No price right now" : `Now ${formatPrice(now)}`}
            </span>
          </span>
        </span>
        <InputGroup size="sm" className="w-[116px] shrink-0 bg-white font-semibold">
          <InputGroupText>$</InputGroupText>
          <InputGroupInput
            aria-label={`${name} floor`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Floor"
            className="text-right tabular-nums"
            value={text ?? priceText(floor)}
            onChange={(event) => {
              const typed = event.currentTarget.value.replace(/[^\d.]/g, "")
              setText(typed)
              if (typed === "") return onChange(null)
              const dollars = Number(typed)
              if (Number.isFinite(dollars)) onChange(Price.make(BigInt(Math.round(dollars * PRICE_SCALE))))
            }}
            onBlur={() => setText(null)}
          />
        </InputGroup>
      </div>
      {now === undefined ?
        null :
        (
          <div className="flex flex-wrap items-center justify-between gap-2 text-label-sm text-g-500">
            <span className="flex gap-1">
              {QUICK_DROPS.map((percent) => (
                <Button
                  key={percent}
                  variant="outline"
                  size="xs"
                  className={cn(
                    "bg-white",
                    floor === under(now, percent) && "text-blue shadow-[0_0_0_1px_var(--color-blue)]"
                  )}
                  onClick={() => {
                    setText(null)
                    onChange(under(now, percent))
                  }}
                >
                  −{percent}%
                </Button>
              ))}
            </span>
            {floor === null ? <span>Pick a drop or type a price</span> : <FloorGap floor={floor} now={now} />}
          </div>
        )}
    </div>
  )
}

/**
 * A floor for each stock the agent trades: the price it has to fall to before the agent may sell it, with today's
 * price beside it and a quick 5, 10 or 20% drop. A stock left empty has no floor, which the policy says it needs.
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
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-[13.5px] font-medium text-g-700">{label}</legend>
      <div className="grid divide-y divide-g-200/70 overflow-hidden rounded-[12px] surface-well">
        {symbols.map((symbol) => (
          <FloorRow
            key={symbol}
            symbol={symbol}
            name={nameOf(symbol)}
            now={stocks.find((stock) => stock.symbol === symbol)?.price?.price}
            floor={priceOf(symbol)}
            onChange={(price) => onChange(withFloor(value, symbols, symbol, price))}
          />
        ))}
      </div>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </fieldset>
  )
}
