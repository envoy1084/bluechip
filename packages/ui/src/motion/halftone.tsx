import { type ComponentProps, useEffect, useRef } from "react"
import { cn } from "../lib/cn.ts"
import { mount, type Palette, registerScene, type Scene } from "./halftone/engine.ts"
import { blocked } from "./halftone/scenes/blocked.ts"
import { butterflies } from "./halftone/scenes/butterflies.ts"
import { clouds } from "./halftone/scenes/clouds.ts"
import { coin } from "./halftone/scenes/coin.ts"
import { garden } from "./halftone/scenes/garden.ts"
import { logo } from "./halftone/scenes/logo.ts"
import { market } from "./halftone/scenes/market.ts"
import { warp } from "./halftone/scenes/warp.ts"

// The engine is framework-free; this module is its public entry, since the package exports only `.tsx` here.
export {
  darkness,
  type HalftoneHandle,
  type HotSpot,
  inkLevel,
  mount,
  type MountOptions,
  type Palette,
  registerScene,
  type Scene,
  type ScenePointer,
  THICKNESS
} from "./halftone/engine.ts"

/** The built-in scenes, by the name the kit uses for each. */
export const HALFTONE_SCENES = { logo, coin, butterflies, market, garden, warp, clouds, blocked } as const

export type HalftoneSceneName = keyof typeof HALFTONE_SCENES

for (const [name, scene] of Object.entries(HALFTONE_SCENES)) registerScene(name, scene)

export interface HalftoneProps extends Omit<ComponentProps<"canvas">, "children"> {
  /** A built-in scene by name, or any scene object. */
  readonly scene: HalftoneSceneName | Scene
  /** Cell size in CSS pixels: smaller is finer. Defaults to the scene's own. */
  readonly cell?: number
  /** Render one composed still frame. Reduced motion always does. */
  readonly still?: boolean
  readonly palette?: Palette
  /** Respond to the pointer over the parent element. Defaults to true. */
  readonly interactive?: boolean
}

/**
 * A line-halftone scene on a canvas sized by CSS (give it a width and height). Pauses offscreen and cleans up on
 * unmount. Decorative by default; pass `aria-label` and `role="img"` when it carries meaning. To replay a scene from
 * the start (`garden`, `blocked`), change its React `key`.
 */
export function Halftone(
  { scene, cell, still = false, palette, interactive = true, className, ...props }: HalftoneProps
) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const handle = mount(canvas, typeof scene === "string" ? HALFTONE_SCENES[scene] : scene, {
      still,
      interactive,
      ...(cell === undefined ? {} : { cell }),
      ...(palette === undefined ? {} : { palette })
    })
    return handle.stop
  }, [scene, cell, still, palette, interactive])
  return (
    <canvas
      ref={ref}
      data-slot="halftone"
      aria-hidden={props.role === "img" ? undefined : true}
      className={cn("block", className)}
      {...props}
    />
  )
}
