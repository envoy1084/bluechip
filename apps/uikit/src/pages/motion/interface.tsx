import { formatMoney, formatPercent } from "@bluechip/ui/lib/format"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { Scramble } from "@bluechip/ui/motion/scramble"
import { useEffect, useRef, useState } from "react"
import { INTERFACE, LINES, STEPS, usd } from "./entries.ts"
import { Card, useSeen } from "./layout.tsx"

interface Quote {
  readonly value: number
  readonly price: number
  readonly step: number
}

// A gentle example tick: the price and the portfolio move together.
const nextQuote = (q: Quote): Quote => {
  const d = STEPS[q.step % STEPS.length] ?? 0
  return {
    value: Math.round((q.value + d * 14.2) * 100) / 100,
    price: Math.round((q.price + d) * 100) / 100,
    step: q.step + 1
  }
}

export function RollCard() {
  const [quote, setQuote] = useState<Quote>({ value: 12480.32, price: 182.4, step: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const seen = useSeen(stage)
  useEffect(() => {
    if (!seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setInterval(() => setQuote(nextQuote), 2600)
    return () => clearInterval(timer)
  }, [seen])
  const change = ((quote.price - 180.17) / 180.17) * 100
  return (
    <Card
      entry={INTERFACE.roll}
      onReplay={() => setQuote(nextQuote)}
      stage={
        <div ref={stage} className="grid justify-items-center gap-2 text-center">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-g-500 uppercase">
            Portfolio value
          </span>
          <NumberRoll
            value={quote.value}
            format={usd}
            className="text-[clamp(34px,5vw,46px)] leading-[1.2] font-semibold tracking-[-0.04em]"
          />
          <div className="inline-flex items-center gap-2.5 rounded-[12px] bg-white py-1.5 pr-2.5 pl-1.5 text-body font-[550] shadow-e1">
            <span className="inline-flex items-center rounded-[7px] bg-[linear-gradient(180deg,#7ad61a,#66c800)] px-[9px] pt-[5px] pb-1 font-pixel text-label font-extrabold tracking-[.05em] text-[#0c2a00]">
              NVDA
            </span>
            <NumberRoll value={quote.price} format={(v) => formatMoney(v)} flash className="px-1" />
            <span className={`text-label tabular-nums ${change >= 0 ? "text-gain" : "text-loss"}`}>
              {formatPercent(change)}
            </span>
          </div>
        </div>
      }
    />
  )
}

export function ScrambleCard() {
  const [line, setLine] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const seen = useSeen(stage)
  return (
    <Card
      entry={INTERFACE.scramble}
      onReplay={() => setLine((l) => l + 1)}
      stage={
        <div ref={stage} className="grid justify-items-center gap-3 px-6 text-center">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Signature moment</span>
          <h3 className="flex min-h-[2.3em] items-center text-[clamp(24px,3vw,32px)] leading-[1.15] font-semibold tracking-[-0.035em]">
            {seen ?
              <Scramble key={line} text={LINES[line % LINES.length] ?? ""} /> :
              LINES[0]}
          </h3>
        </div>
      }
    />
  )
}
