import { cn } from "@bluechip/ui/lib/cn"
import { useRef } from "react"
import { useInView } from "../hooks/useInView.ts"

// A made-up day of Chainlink's price for one stock, in points across the chart, and the trades made around it.
const PRICE = [62, 58, 60, 54, 57, 50, 52, 47, 49, 44, 46, 41, 43, 45, 40, 42, 38, 41, 37, 39]
const TRADES: ReadonlyArray<{ readonly at: number; readonly off: number; readonly fills: boolean }> = [
  { at: 3, off: 4, fills: true },
  { at: 8, off: -5, fills: true },
  { at: 12, off: 22, fills: false },
  { at: 16, off: 3, fills: true }
]
const BAND = 9

const x = (index: number) => 12 + (index * 376) / (PRICE.length - 1)
const y = (value: number) => 18 + (value - 30) * 2.6
const line = (offset: number) =>
  PRICE.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value + offset).toFixed(1)}`)
    .join(" ")

/**
 * Chainlink's price with the band a trade must fill inside: fills inside it land, the one far outside is refused.
 * A white cover slides off to draw it the first time it is seen.
 */
export function FairPriceChart() {
  const root = useRef<HTMLDivElement>(null)
  const seen = useInView(root)
  const band = `${line(-BAND)} ${
    [...PRICE].reverse().map((value, index) =>
      `L${x(PRICE.length - 1 - index).toFixed(1)} ${y(value + BAND).toFixed(1)}`
    ).join(" ")
  } Z`

  return (
    <div ref={root} className="relative overflow-hidden">
      <svg viewBox="0 0 400 150" className="block h-auto w-full" aria-hidden>
        <path d={band} className="fill-blue-100/70" />
        <path d={line(0)} className="fill-none stroke-blue" strokeWidth={2.2} strokeLinejoin="round" />
        {TRADES.map((trade) => {
          const px = x(trade.at), py = y((PRICE[trade.at] ?? 0) + trade.off)
          return trade.fills ?
            <circle key={trade.at} cx={px} cy={py} r={5} className="fill-gain stroke-white" strokeWidth={2} /> :
            (
              <g key={trade.at} className="stroke-loss" strokeWidth={2.2} strokeLinecap="round">
                <circle cx={px} cy={py} r={8} className="fill-loss-wash" strokeWidth={1.5} />
                <path d={`M${px - 3.5} ${py - 3.5}l7 7m0 -7l-7 7`} />
              </g>
            )
        })}
      </svg>
      <span
        aria-hidden
        data-seen={seen || undefined}
        className="absolute inset-0 origin-right bg-g-50 transition-transform delay-200 duration-[1800ms] ease-in-out data-seen:scale-x-0 motion-reduce:scale-x-0 motion-reduce:transition-none"
      />
    </div>
  )
}

const MARKS = [
  "Your recovery key asks",
  "Cancel any time, without Face ID",
  "After 48 hours it can go through"
] as const

/** The recovery wait as a track that fills over the 48 hours, with what can happen along it. */
export function RecoveryTrack() {
  const root = useRef<HTMLDivElement>(null)
  const seen = useInView(root)

  return (
    <div ref={root} className="grid gap-3">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-g-100">
        <span
          data-seen={seen || undefined}
          className="absolute inset-0 origin-left scale-x-0 rounded-full bg-[linear-gradient(90deg,var(--color-blue),var(--color-cerulean))] transition-transform delay-300 duration-[2600ms] ease-in-out data-seen:scale-x-100 motion-reduce:scale-x-100 motion-reduce:transition-none"
        />
      </div>
      <ol className="grid grid-cols-3 text-label-sm text-g-600">
        {MARKS.map((mark, index) => (
          <li key={mark} className={cn(index === 1 && "text-center", index === 2 && "text-right")}>{mark}</li>
        ))}
      </ol>
    </div>
  )
}
