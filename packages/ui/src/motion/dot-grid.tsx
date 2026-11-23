import { type ComponentProps, useEffect, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { dotGrid, type Rgb } from "./effects/dot-grid.ts"

export interface DotGridProps extends Omit<ComponentProps<"canvas">, "children" | "color"> {
  /** Cell pitch in CSS pixels. Defaults to 14. */
  readonly cell?: number
  readonly gap?: number
  /** Square color. Pass a constant: a new array restarts the grid. */
  readonly color?: Rgb
  /** Color the ripple tints squares toward. Pass a constant too. */
  readonly accent?: Rgb
  readonly threshold?: number
  /** Pointer reach in CSS pixels. */
  readonly radius?: number
  readonly vignette?: boolean
  /** A ripple from the centre every 4.5 s. Defaults to true. */
  readonly auto?: boolean
}

/**
 * The reactive grid for onboarding and page backgrounds. Squares spring away from the pointer and ripple on tap.
 * Fills its parent; give the parent a size and `position: relative`. Under reduced motion it is a still noise field.
 */
export function DotGrid(
  { cell, gap, color, accent, threshold, radius, vignette, auto, className, ...props }: DotGridProps
) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const handle = dotGrid(canvas, {
      ...(cell === undefined ? {} : { cell }),
      ...(gap === undefined ? {} : { gap }),
      ...(color === undefined ? {} : { color }),
      ...(accent === undefined ? {} : { accent }),
      ...(threshold === undefined ? {} : { threshold }),
      ...(radius === undefined ? {} : { radius }),
      ...(vignette === undefined ? {} : { vignette }),
      ...(auto === undefined ? {} : { auto })
    })
    return handle.stop
  }, [cell, gap, color, accent, threshold, radius, vignette, auto])
  return (
    <canvas
      ref={ref}
      data-slot="dot-grid"
      aria-hidden
      className={cn("absolute inset-0 block size-full", className)}
      {...props}
    />
  )
}
