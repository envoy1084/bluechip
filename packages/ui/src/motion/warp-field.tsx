import { type ComponentProps, type Ref, useEffect, useImperativeHandle, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { warpField, type WarpFieldHandle } from "./effects/warp-field.ts"

export interface WarpFieldControls {
  /** A burst of speed, as when someone reaches for the main action. */
  readonly surge: () => void
}

export interface WarpFieldProps extends Omit<ComponentProps<"canvas">, "children" | "ref"> {
  readonly ref?: Ref<WarpFieldControls>
  /** Market symbols that fly past as ticker chips. Pass a constant: a new array restarts the field. */
  readonly symbols?: ReadonlyArray<string>
  /** Streaks per 10,000 square CSS pixels. Defaults to 6. */
  readonly density?: number
  /** Seconds the launch takes to ease into the cruise. Defaults to 2.4. */
  readonly launch?: number
}

/**
 * The landing hero's warp: blue streaks and ticker chips rushing out of a vanishing point. It launches at speed and
 * settles into a cruise, leans toward the pointer and surges on a press. Fills its parent; give the parent a size and
 * `position: relative`. Pauses offscreen and in a hidden tab; under reduced motion it is one still frame.
 */
export function WarpField({ ref, symbols, density, launch, className, ...props }: WarpFieldProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const handle = useRef<WarpFieldHandle | null>(null)

  useImperativeHandle(ref, () => ({ surge: () => handle.current?.surge() }), [])

  useEffect(() => {
    if (!canvas.current) return
    const field = warpField(canvas.current, {
      ...(symbols === undefined ? {} : { symbols }),
      ...(density === undefined ? {} : { density }),
      ...(launch === undefined ? {} : { launch })
    })
    handle.current = field
    return () => {
      field.stop()
      handle.current = null
    }
  }, [symbols, density, launch])

  return (
    <canvas
      ref={canvas}
      data-slot="warp-field"
      aria-hidden
      className={cn("absolute inset-0 block size-full", className)}
      {...props}
    />
  )
}
