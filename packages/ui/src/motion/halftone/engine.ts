/* The line-halftone engine, ported from the kit (halftone.js). A scene draws a greyscale picture into a small
   offscreen canvas, one pixel per cell; the engine redraws every cell as a vertical capsule whose thickness and
   color come from how dark the cell is, Base-style. Framework-free: React mounts it from `../halftone.tsx`. */
import { prefersReducedMotion } from "../reduced-motion.ts"

/** Four inks, lightest to darkest, one per halftone level. */
export type Palette = readonly [string, string, string, string]

/** A highlight a scene can set for one frame: cells within `r` get at least some ink, in `color` or gold. */
export interface HotSpot {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly color?: string
}

/** What a scene sees of the pointer: `x`, `y` eased in −1..1 across the canvas, `px`, `py` in CSS pixels. */
export interface ScenePointer {
  readonly x: number
  readonly y: number
  readonly px: number
  readonly py: number
  /** Set during `draw` to light a spot this frame; the engine clears it before every frame. */
  hot: HotSpot | null
}

export interface Scene {
  readonly palette: Palette
  /** Cell size in CSS pixels. Defaults to 9. */
  readonly cell?: number
  /** Seconds into the loop shown as the still frame under reduced motion. Defaults to 2.6. */
  readonly stillAt?: number
  /** Seconds the loop starts ahead. */
  readonly offset?: number
  /** Ink for light cells under the pointer. Defaults to pink. */
  readonly touch?: string
  /** Draw the picture in greys at time `t` (seconds) on a `width` × `height` CSS-pixel space. */
  readonly draw: (
    ctx: CanvasRenderingContext2D,
    t: number,
    width: number,
    height: number,
    pointer: ScenePointer
  ) => void
}

/** Capsule width as a share of the cell, per level. */
export const THICKNESS: readonly [number, number, number, number] = [0.22, 0.4, 0.6, 0.82]

export type Level = 0 | 1 | 2 | 3

/** The halftone level for a darkness in 0..1. Below `MIN_INK` nothing is drawn. */
export const inkLevel = (ink: number): Level => (ink < 0.3 ? 0 : ink < 0.55 ? 1 : ink < 0.8 ? 2 : 3)

/** Cells lighter than this stay empty. */
export const MIN_INK = 0.05

/** Darkness of an RGB pixel in 0..1, by luma. */
export const darkness = (r: number, g: number, b: number): number => 1 - (r * 0.299 + g * 0.587 + b * 0.114) / 255

const registry = new Map<string, Scene>()

/** Register a scene under a name so it can be mounted by name. */
export const registerScene = (name: string, scene: Scene): void => {
  registry.set(name, scene)
}

export const getScene = (name: string): Scene | undefined => registry.get(name)

export interface MountOptions {
  readonly palette?: Palette
  readonly cell?: number
  /** Render one still frame. Reduced motion always does. */
  readonly still?: boolean
  /** Respond to the pointer. Defaults to true; never while still. */
  readonly interactive?: boolean
  /** The element that receives pointer events. Defaults to the canvas's parent. */
  readonly host?: HTMLElement
}

export interface HalftoneHandle {
  /** Stop drawing and release every observer and listener. */
  readonly stop: () => void
  /** Start the loop again from where it is (used to replay a scene). */
  readonly restart: () => void
}

const NOOP: HalftoneHandle = { stop: () => {}, restart: () => {} }
const POINTER_RADIUS = 90
const FADE_IN = 1.2

/** Mount a scene on a canvas sized by CSS. Pauses offscreen, follows resizes and the device pixel ratio. */
export const mount = (canvas: HTMLCanvasElement, scene: Scene | string, options: MountOptions = {}): HalftoneHandle => {
  const def = typeof scene === "string" ? registry.get(scene) : scene
  const ctx = canvas.getContext("2d")
  const off = document.createElement("canvas")
  const octx = off.getContext("2d", { willReadFrequently: true })
  if (!def || !ctx || !octx) return NOOP

  const palette = options.palette ?? def.palette
  const cell = options.cell ?? def.cell ?? 9
  const still = options.still === true || prefersReducedMotion()
  const touch = def.touch ?? "#fea8cd"
  let width = 0, height = 0, cols = 0, rows = 0, dpr = 1
  let running = false, visible = true, dead = false, raf = 0
  // In still mode only a new size calls for a new frame; this is the size last drawn.
  let drawnSize = ""
  let start = performance.now() - (def.offset ?? 0) * 1000
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, px: -1e4, py: -1e4, hot: null as HotSpot | null }

  const measure = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = canvas.clientWidth
    height = canvas.clientHeight
    if (!width || !height) return
    // Assigning a canvas's size clears it, even to the same value: only resize when it changed, or a
    // ResizeObserver callback right after a still frame would wipe that frame.
    const w = Math.round(width * dpr), h = Math.round(height * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    cols = Math.max(1, Math.floor(width / cell))
    rows = Math.max(1, Math.floor(height / cell))
    if (off.width !== cols || off.height !== rows) {
      off.width = cols
      off.height = rows
    }
  }

  const render = (t: number): void => {
    pointer.x += (pointer.tx - pointer.x) * 0.06
    pointer.y += (pointer.ty - pointer.y) * 0.06
    pointer.hot = null
    octx.setTransform(1, 0, 0, 1, 0, 0)
    octx.fillStyle = "#fff"
    octx.fillRect(0, 0, cols, rows)
    octx.setTransform(cols / width, 0, 0, rows / height, 0, 0)
    def.draw(octx, t, width, height, pointer)
    const data = octx.getImageData(0, 0, cols, rows).data
    const fade = still ? 1 : Math.min(1, t / FADE_IN)
    // `draw` may have set a hot spot; the cast stops TypeScript narrowing it to the null set above.
    const hot = pointer.hot as HotSpot | null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const cw = width / cols, ch = height / rows
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4
        const cx = (i + 0.5) * cw, cy = (j + 0.5) * ch
        const d = Math.hypot(cx - pointer.px, cy - pointer.py)
        const near = d < POINTER_RADIUS ? 1 - d / POINTER_RADIUS : 0
        let ink = darkness(data[k], data[k + 1], data[k + 2]) * fade + near * 0.12
        let lit = false
        if (hot) {
          const dh = Math.hypot(cx - hot.x, cy - hot.y)
          if (dh < hot.r) {
            ink = Math.max(ink, 0.3 + 0.5 * (1 - dh / hot.r))
            lit = true
          }
        }
        if (ink < MIN_INK) continue
        const level = inkLevel(ink)
        const w = cw * THICKNESS[level] * (1 + near * 0.25), h = ch * 0.84
        ctx.fillStyle = lit && hot ?
          (hot.color ?? (level > 1 ? "#ffd12f" : "#ffe27a")) :
          near > 0.55 && level < 2 ?
          touch :
          palette[level]
        ctx.beginPath()
        ctx.roundRect(cx - w / 2, cy - h / 2, w, h, w / 2)
        ctx.fill()
      }
    }
  }

  const stillFrame = (): void => {
    if (!width || !height) measure()
    const size = `${width}x${height}x${dpr}`
    if (!width || !height || size === drawnSize) return
    drawnSize = size
    render(def.stillAt ?? 2.6)
  }

  const frame = (now: number): void => {
    raf = 0
    if (dead) return
    if (!canvas.isConnected) {
      stop()
      return
    }
    if (!width || !height) measure()
    if (width && height) render((now - start) / 1000)
    if (running) raf = requestAnimationFrame(frame)
  }

  const play = (): void => {
    if (dead || !visible) return
    if (still) {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0
          if (!dead) stillFrame()
        })
      }
      return
    }
    if (!running) {
      running = true
      raf = requestAnimationFrame(frame)
    }
  }

  const pause = (): void => {
    running = false
    cancelAnimationFrame(raf)
    raf = 0
  }

  measure()
  const resizeObserver = new ResizeObserver(() => {
    const before = `${width}x${height}`
    measure()
    if (`${width}x${height}` === before && drawnSize !== "") return
    if (still) play()
    else if (!running && width && height) render((performance.now() - start) / 1000)
  })
  resizeObserver.observe(canvas)
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    if (visible) play()
    else pause()
  })
  intersectionObserver.observe(canvas)

  const host = options.host ?? canvas.parentElement
  const move = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect()
    pointer.px = event.clientX - rect.left
    pointer.py = event.clientY - rect.top
    pointer.tx = (pointer.px / rect.width - 0.5) * 2
    pointer.ty = (pointer.py / rect.height - 0.5) * 2
  }
  const leave = (): void => {
    pointer.px = pointer.py = -1e4
    pointer.tx = pointer.ty = 0
  }
  const interactive = !still && options.interactive !== false
  if (interactive) {
    host?.addEventListener("pointermove", move)
    host?.addEventListener("pointerleave", leave)
  }

  function stop(): void {
    dead = true
    pause()
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    host?.removeEventListener("pointermove", move)
    host?.removeEventListener("pointerleave", leave)
  }

  play()
  return {
    stop,
    restart: () => {
      if (dead) return
      pause()
      start = performance.now() - (def.offset ?? 0) * 1000
      drawnSize = ""
      play()
    }
  }
}
