import NumberFlow, { type Format } from "@number-flow/react"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"
import { EASE } from "./easing.ts"
import { usePriceFlash } from "./use-price-flash.ts"

export interface NumberRollProps extends Omit<ComponentProps<"span">, "children"> {
  readonly value: number
  /** Intl options (en-US), or a formatter such as `formatMoney` from `lib/format.ts`. */
  readonly format?: Intl.NumberFormatOptions | ((value: number) => string)
  /** Tint the number briefly when it changes: Gain when it rose, Loss when it fell. */
  readonly flash?: boolean
}

interface FlowParts {
  readonly prefix: string
  readonly magnitude: number
  readonly suffix: string
  readonly format: Format
}

const NUMBER = /^(.*?)(\d[\d,]*(?:\.\d+)?)(.*)$/u

// NumberFlow formats with Intl itself, so formatted text is split back into the parts it can animate: the digits,
// with the same decimals and grouping, between whatever the formatter put around them ("−$", " USDC", "M").
const toFlow = (text: string): FlowParts | undefined => {
  const match = NUMBER.exec(text)
  if (!match) return undefined
  const [, prefix = "", digits = "", suffix = ""] = match
  const decimals = digits.split(".")[1]?.length ?? 0
  return {
    prefix,
    suffix,
    magnitude: Number(digits.replaceAll(",", "")),
    format: { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: digits.includes(",") }
  }
}

const TRANSFORM = { duration: 640, easing: EASE.brand }
const OPACITY = { duration: 320, easing: "ease-out" }

/**
 * A number whose digits roll to each new value (NumberFlow), for balances, prices and agent spend counters. Screen
 * readers get the formatted text. Under reduced motion digits change in place.
 */
export function NumberRoll({ value, format, flash = false, className, ...props }: NumberRollProps) {
  const text = typeof format === "function" ? format(value) : new Intl.NumberFormat("en-US", format).format(value)
  const parts = toFlow(text)
  const flashClass = usePriceFlash(value)
  return (
    <span
      data-slot="number-roll"
      className={cn("inline-flex items-baseline whitespace-nowrap tabular-nums", flash && flashClass, className)}
      {...props}
    >
      <span className="sr-only">{text}</span>
      {parts === undefined ?
        <span aria-hidden>{text}</span> :
        (
          <NumberFlow
            // A string: React sets `true` on a custom element as an empty attribute, which doesn't hide it.
            aria-hidden="true"
            value={parts.magnitude}
            prefix={parts.prefix}
            suffix={parts.suffix}
            format={parts.format}
            locales="en-US"
            // The sign lives in the prefix, so the digits spin the way the signed value moved.
            trend={(before, after) => Math.sign(after - before) * (value < 0 ? -1 : 1)}
            transformTiming={TRANSFORM}
            spinTiming={TRANSFORM}
            opacityTiming={OPACITY}
          />
        )}
    </span>
  )
}
