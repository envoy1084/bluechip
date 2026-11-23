import { type ComponentProps, useEffect, useEffectEvent, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { type ConfettiOptions, fireConfetti } from "./effects/confetti.ts"

export { type ConfettiHandle, type ConfettiOptions, fireConfetti } from "./effects/confetti.ts"

export interface ConfettiProps
  extends Omit<ComponentProps<"canvas">, "children" | "onDone">, Omit<ConfettiOptions, "onDone">
{
  readonly onDone?: () => void
}

/**
 * Chip confetti over its parent (give the parent `position: relative`). For a first deposit or a first filled
 * trade, once per account. It bursts on mount; change its React `key` to burst again. Under reduced motion nothing
 * is drawn: the message carries the moment.
 */
export function Confetti({ x, y, count, colors, onDone, className, ...props }: ConfettiProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const done = useEffectEvent(() => onDone?.())
  // One burst per mount; changing its options mid-flight does not restart it.
  const fire = useEffectEvent((canvas: HTMLCanvasElement) =>
    fireConfetti(canvas, {
      ...(x === undefined ? {} : { x }),
      ...(y === undefined ? {} : { y }),
      ...(count === undefined ? {} : { count }),
      ...(colors === undefined ? {} : { colors }),
      onDone: done
    })
  )
  useEffect(() => {
    if (!ref.current) return
    return fire(ref.current).stop
  }, [])
  return (
    <canvas
      ref={ref}
      data-slot="confetti"
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-[5] block size-full", className)}
      {...props}
    />
  )
}
