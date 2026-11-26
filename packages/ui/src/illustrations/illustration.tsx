import { type ComponentProps, useEffect, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { mount } from "../motion/halftone/engine.ts"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"
import { illustrationScene } from "./halftone.ts"
import { type IllustrationName, OBJECTS } from "./objects.ts"
import { paintPixels } from "./pixel.ts"

export { ILLUSTRATION_NAMES, type IllustrationName, OBJECTS as ILLUSTRATIONS } from "./objects.ts"

export type IllustrationVariant = "pixel" | "halftone"

export interface IllustrationProps extends Omit<ComponentProps<"canvas">, "children"> {
  readonly name: IllustrationName
  /** Pixel inside the product (24 to 96 px); halftone at 160 px and up. Defaults to pixel. */
  readonly variant?: IllustrationVariant
  /** CSS pixels, square: 24, 48, 96, 160 or 240. Defaults to 48. */
  readonly size?: number
  /** Let a halftone drift and respond to the pointer. Defaults to true from 240 px; never under reduced motion. */
  readonly animate?: boolean
  /** Accessible name. Defaults to the object's label. */
  readonly label?: string
  /** Halftone cell size in CSS pixels. Defaults to about thirty lines across. */
  readonly cell?: number
}

/** One of the illustration objects, drawn as crisp pixel art or as line halftone from the same shapes. */
export function Illustration(
  { name, variant = "pixel", size = 48, animate, label, cell, className, style, ...props }: IllustrationProps
) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const moving = (animate ?? size >= 240) && !reduced
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (variant === "pixel") {
      paintPixels(canvas, name, size)
      return
    }
    const handle = mount(canvas, illustrationScene(name), {
      still: !moving,
      interactive: moving,
      cell: cell ?? Math.max(4, Math.min(8, Math.round(size / 36)))
    })
    return handle.stop
  }, [name, variant, size, moving, cell])
  return (
    <canvas
      ref={ref}
      data-slot="illustration"
      data-variant={variant}
      // A canvas has no semantic element that can be drawn on, so it takes the img role.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={label ?? OBJECTS[name].label}
      className={cn(
        "block aspect-square h-auto max-w-full",
        variant === "pixel" && "[image-rendering:pixelated]",
        className
      )}
      style={{ width: size, ...style }}
      {...props}
    />
  )
}
