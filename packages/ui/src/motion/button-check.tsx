import { type ComponentProps, useEffect, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { EASE } from "./easing.ts"
import { prefersReducedMotion } from "./reduced-motion.ts"

export interface ButtonCheckProps extends Omit<ComponentProps<"span">, "children"> {
  /** CSS pixels, square. Defaults to 20. */
  readonly size?: number
}

/**
 * The done mark inside a button, in the button's own colour: a ring that pops in, then a check that draws itself.
 * Under reduced motion it shows already drawn. Decorative: the button's label says what was done.
 */
export function ButtonCheck({ size = 20, className, ...props }: ButtonCheckProps) {
  const ring = useRef<SVGCircleElement>(null)
  const tick = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    ring.current?.animate(
      [{ strokeDashoffset: 1, opacity: 0.4 }, { strokeDashoffset: 0, opacity: 1 }],
      { duration: 320, easing: EASE.brand, fill: "backwards" }
    )
    tick.current?.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 260, delay: 200, easing: "ease-out", fill: "backwards" }
    )
    tick.current?.parentElement?.animate(
      [{ transform: "scale(.7)" }, { transform: "scale(1.08)", offset: 0.6 }, { transform: "none" }],
      { duration: 420, easing: EASE.brand }
    )
  }, [])

  return (
    <span
      data-slot="button-check"
      aria-hidden
      className={cn("inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size} className="origin-center">
        <circle
          ref={ring}
          cx="12"
          cy="12"
          r="10"
          pathLength={1}
          strokeDasharray="1"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="-rotate-90 origin-center"
        />
        <path
          ref={tick}
          d="M7.5 12.4l3 3 6-6.4"
          pathLength={1}
          strokeDasharray="1"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
