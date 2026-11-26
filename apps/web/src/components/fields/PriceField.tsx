import { Price } from "@bluechip/domain/market/Units"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { cn } from "@bluechip/ui/lib/cn"
import { useId, useState } from "react"

const PRICE_SCALE = 100_000_000

const priceText = (price: bigint | null): string =>
  price === null || price === BigInt(0) ? "" : String(Number(price) / PRICE_SCALE)

/**
 * A price for one share, in dollars and cents, as Chainlink keeps it (USD × 1e8). It keeps its own text while it is
 * typed in, so "15." doesn't snap to "15"; an empty field is no price (`null`).
 */
export function PriceField(
  { label, help, value, problem, onChange }: Readonly<{
    label: string
    help?: string | undefined
    value: bigint | null
    problem?: string | undefined
    onChange: (price: Price | null) => void
  }>
) {
  const id = useId()
  const [text, setText] = useState<string | null>(null)
  const note = problem ?? help

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-medium text-g-700">{label}</label>
        <InputGroup size="sm" className="w-[120px] shrink-0 font-semibold">
          <InputGroupText>$</InputGroupText>
          <InputGroupInput
            id={id}
            inputMode="decimal"
            autoComplete="off"
            placeholder="150.00"
            className="text-right tabular-nums"
            value={text ?? priceText(value)}
            aria-invalid={problem === undefined ? undefined : true}
            aria-describedby={note === undefined ? undefined : `${id}-note`}
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
      {note === undefined ? null : (
        <p
          id={`${id}-note`}
          className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}
        >
          {note}
        </p>
      )}
    </div>
  )
}
