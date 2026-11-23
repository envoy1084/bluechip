import { type ComponentProps, useEffect, useState } from "react"
import { cn } from "../lib/cn.ts"
import { usePriceFlash } from "./use-price-flash.ts"
import { useReducedMotion } from "./use-reduced-motion.ts"

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9"
const REEL_MASK = "linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent)"

export interface NumberRollProps extends Omit<ComponentProps<"span">, "children"> {
  readonly value: number
  /** Intl options (en-US), or a formatter such as `formatMoney` from `lib/format.ts`. */
  readonly format?: Intl.NumberFormatOptions | ((value: number) => string)
  /** Delay between digits in ms, rightmost first. Defaults to 28. */
  readonly stagger?: number
  /** Tint the number briefly when it changes: Gain when it rose, Loss when it fell. */
  readonly flash?: boolean
}

/**
 * A number whose digits roll to each new value, for balances, prices and agent spend counters. Screen readers get
 * the formatted text. Under reduced motion digits change in place.
 */
export function NumberRoll({ value, format, stagger = 28, flash = false, className, ...props }: NumberRollProps) {
  const text = typeof format === "function" ? format(value) : new Intl.NumberFormat("en-US", format).format(value)
  const chars = [...text]
  // Reels are rebuilt when the shape changes (a new digit, a comma); they start at 0 and roll in.
  const shape = chars.map((ch) => (isDigit(ch) ? "0" : ch)).join("")
  const reduced = useReducedMotion()
  const [rolledShape, setRolledShape] = useState("")
  const rolled = reduced || rolledShape === shape
  useEffect(() => {
    if (rolled) return
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setRolledShape(shape))
    })
    return () => cancelAnimationFrame(raf)
  }, [rolled, shape])
  const flashClass = usePriceFlash(value)
  const reels = chars.filter(isDigit).length
  // Reels are keyed by their place from the right: the units reel stays the units reel.
  const places = chars.map((ch, i) => ({ ch, place: chars.length - i }))
  let reel = 0
  return (
    <span
      data-slot="number-roll"
      className={cn("inline-flex items-baseline whitespace-nowrap tabular-nums", flash && flashClass, className)}
      {...props}
    >
      <span className="sr-only">{text}</span>
      <span key={shape} aria-hidden className="inline-flex items-baseline">
        {places.map(({ ch, place }) => {
          if (!isDigit(ch)) {
            return <span key={place} className="inline-block h-[1.2em] leading-[1.2em]">{ch}</span>
          }
          reel++
          return (
            <span
              key={place}
              className="inline-block h-[1.2em] overflow-hidden align-bottom leading-[1.2em]"
              style={{ maskImage: REEL_MASK }}
            >
              <span
                className="flex flex-col transition-transform duration-slow ease-brand"
                style={{
                  transform: `translateY(${rolled ? -10 * Number(ch) : 0}%)`,
                  transitionDelay: reduced ? "0ms" : `${(reels - reel) * stagger}ms`
                }}
              >
                {DIGITS.map((digit) => <span key={digit} className="block h-[1.2em]">{digit}</span>)}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
