import { type ComponentProps, type Ref, useEffect, useEffectEvent, useImperativeHandle, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { assemble } from "./effects/assemble.ts"
import type { OneShot } from "./effects/canvas.ts"

export interface ButterflyAssembleHandle {
  readonly play: () => void
}

export interface ButterflyAssembleProps extends Omit<ComponentProps<"canvas">, "children" | "ref" | "id"> {
  readonly ref?: Ref<ButterflyAssembleHandle>
  /** The agent's id: the same id always assembles the same butterfly as its avatar. */
  readonly agentId: string
  /** Called once the butterfly has landed and rested. */
  readonly onDone?: () => void
  /** Accessible name. Defaults to "<agentId>'s butterfly". */
  readonly label?: string
}

/**
 * A new agent's pixel butterfly assembling, then two wing beats. Plays when it scrolls into view, again when
 * `agentId` changes, and on `ref.current.play()`. Under reduced motion it shows the finished butterfly.
 */
export function ButterflyAssemble({ ref, agentId, onDone, label, className, ...props }: ButterflyAssembleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const anim = useRef<OneShot | null>(null)
  const done = useEffectEvent(() => onDone?.())
  const first = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // The first butterfly waits to be seen; a new id afterwards plays straight away.
    const autoplay = first.current
    first.current = false
    const handle = assemble(canvas, agentId, { autoplay, onDone: done })
    anim.current = handle
    if (!autoplay) handle.play()
    return () => {
      handle.stop()
      anim.current = null
    }
  }, [agentId])

  useImperativeHandle(ref, () => ({ play: () => anim.current?.play() }), [])

  return (
    <canvas
      ref={canvasRef}
      data-slot="butterfly-assemble"
      // A canvas has no semantic element that can be drawn on, so it takes the img role.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={label ?? `${agentId}'s butterfly`}
      className={cn("block size-40", className)}
      {...props}
    />
  )
}
