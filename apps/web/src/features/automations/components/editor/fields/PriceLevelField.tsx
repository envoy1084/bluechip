import type { Stock } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { formatPrice } from "@bluechip/domain/policies/Format"
import { Button } from "@bluechip/ui/components/button"
import { PriceField } from "../../../../../components/fields/PriceField.tsx"

const STEPS = [-10, -5, 5, 10] as const

// `percent` away from `now`, to the cent.
const away = (now: bigint, percent: number) =>
  Price.make(BigInt(Math.round((Number(now) * (100 + percent)) / 100 / 1_000_000)) * BigInt(1_000_000))

/** How far the level is from today's price, in words: "8.2% under it". */
const gapText = (level: bigint, now: bigint): string => {
  if (level === now) return "the same price"
  const gap = Math.abs(((Number(level) - Number(now)) / Number(now)) * 100)
  return `${gap.toFixed(gap < 10 ? 1 : 0)}% ${level < now ? "under" : "over"} it`
}

/**
 * A price for a stock, with that stock's price today under it, how far the level is from it, and a click to set it a
 * few percent either side. Without a price today it's the plain field.
 */
export function PriceLevelField(
  { label, value, stock, problem, onChange }: Readonly<{
    label: string
    value: bigint
    /** The stock the price is about, when the entry has one. */
    stock: Stock | undefined
    problem?: string | undefined
    onChange: (price: Price) => void
  }>
) {
  const now = stock?.price?.price ?? null

  return (
    <div className="grid gap-2">
      <PriceField
        label={label}
        value={value}
        problem={problem}
        onChange={(price) => onChange(price ?? Price.make(BigInt(0)))}
      />
      {now === null || stock === undefined ?
        null :
        (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-label-sm text-g-500 tabular-nums">
            <span>
              {stock.name} is {formatPrice(now)} now
              {value > BigInt(0) ? `, so this is ${gapText(value, now)}` : ""}
            </span>
            <span className="flex gap-1">
              {STEPS.map((percent) => (
                <Button
                  key={percent}
                  variant="secondary"
                  size="xs"
                  aria-label={`Set it ${Math.abs(percent)}% ${percent < 0 ? "under" : "over"} today's price`}
                  aria-pressed={value === away(now, percent)}
                  className="tabular-nums aria-pressed:bg-blue-50 aria-pressed:bg-none aria-pressed:text-blue aria-pressed:shadow-[inset_0_0_0_1px_var(--color-info-line)]"
                  onClick={() => onChange(away(now, percent))}
                >
                  {percent > 0 ? `+${percent}%` : `−${Math.abs(percent)}%`}
                </Button>
              ))}
            </span>
          </div>
        )}
    </div>
  )
}
