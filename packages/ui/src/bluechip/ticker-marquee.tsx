import { useEffect, useRef, useState } from "react"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"
import { PriceChange } from "./price-change.tsx"
import { TickerChip } from "./ticker-chip.tsx"

export interface MarqueeQuote {
  readonly symbol: string
  readonly price: number
  /** Change since the last close, in percent. */
  readonly change: number
}

export interface TickerMarqueeProps {
  readonly quotes: ReadonlyArray<MarqueeQuote>
  /** Seconds per loop. Defaults to 40. */
  readonly duration?: number
  readonly className?: string
}

const EDGE_MASK = "linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent)"

function Quotes(
  { quotes, hidden = false }: { readonly quotes: ReadonlyArray<MarqueeQuote>; readonly hidden?: boolean }
) {
  return (
    <ul className="flex shrink-0 gap-2.5 pr-2.5" {...(hidden ? { "aria-hidden": true } : {})}>
      {quotes.map((q) => (
        <li
          key={q.symbol}
          className="inline-flex items-center gap-2 rounded-[12px] bg-white py-1.5 pr-3 pl-1.5 text-[13.5px] font-[550] whitespace-nowrap shadow-e1"
        >
          <TickerChip symbol={q.symbol} size="sm" />
          <span className="tabular-nums">{formatMoney(q.price)}</span>
          <PriceChange value={q.change} />
        </li>
      ))}
    </ul>
  )
}

/**
 * A slow strip of live prices for the landing page and home. It pauses on hover and focus and has a pause button
 * (WCAG 2.2.2). With reduced motion it stands still as a row you can scroll.
 */
export function TickerMarquee({ quotes, duration = 40, className }: TickerMarqueeProps) {
  const reduced = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const el = track.current
    if (!el || reduced) return
    // The track holds the list twice, so sliding by half loops without a seam.
    const run = el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }], {
      duration: duration * 1000,
      iterations: Infinity,
      easing: "linear"
    })
    animation.current = run
    return () => {
      run.cancel()
      animation.current = null
    }
  }, [reduced, duration])

  useEffect(() => {
    const run = animation.current
    if (!run) return
    if (paused || hovered) run.pause()
    else run.play()
  }, [paused, hovered])

  return (
    <div
      data-slot="ticker-marquee"
      className={cn("relative flex w-full items-center gap-2", className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <section
        aria-label="Prices"
        className={cn("min-w-0 flex-1 py-1", reduced ? "overflow-x-auto" : "overflow-hidden")}
        style={{ maskImage: EDGE_MASK }}
      >
        <div ref={track} className="flex w-max">
          <Quotes quotes={quotes} />
          {!reduced && <Quotes quotes={quotes} hidden />}
        </div>
      </section>
      {!reduced && (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Pause prices"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
          className="mr-4"
        >
          <Icon name={paused ? "play" : "pause"} size={14} />
        </Button>
      )}
    </div>
  )
}
