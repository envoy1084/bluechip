import { type ComponentProps, type Ref, useEffect, useEffectEvent, useImperativeHandle, useRef } from "react"
import { cn } from "../lib/cn.ts"
import type { OneShot } from "./effects/canvas.ts"
import { seal } from "./effects/seal.ts"

export interface SealHandle {
  /** Play the seal from the start. */
  readonly play: () => void
}

export interface SealProps extends Omit<ComponentProps<"canvas">, "children" | "ref"> {
  readonly ref?: Ref<SealHandle>
  /**
   * Controls playback: it plays each time this turns true. Without it the seal plays the first time it scrolls
   * into view, and again on `ref.current.play()`.
   */
  readonly playing?: boolean
  /** Called when the seal has formed (at once under reduced motion). */
  readonly onDone?: () => void
  /** Accessible name. Defaults to "Approved with Face ID". */
  readonly label?: string
}

/** The pixel seal that forms when Face ID approves: pixels land, the check flips white, a shine sweeps across. */
export function Seal({ ref, playing, onDone, label = "Approved with Face ID", className, ...props }: SealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const anim = useRef<OneShot | null>(null)
  const done = useEffectEvent(() => onDone?.())
  const controlled = playing !== undefined

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    anim.current = seal(canvas, { autoplay: !controlled, onDone: done })
    return () => {
      anim.current?.stop()
      anim.current = null
    }
  }, [controlled])

  useEffect(() => {
    if (playing === true) anim.current?.play()
  }, [playing])

  useImperativeHandle(ref, () => ({ play: () => anim.current?.play() }), [])

  return (
    <canvas
      ref={canvasRef}
      data-slot="seal"
      // A canvas has no semantic element that can be drawn on, so it takes the img role.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={label}
      className={cn("block size-36", className)}
      {...props}
    />
  )
}
