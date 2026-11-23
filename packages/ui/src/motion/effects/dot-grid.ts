/* The reactive grid: rounded squares sized by drifting value noise, springing away from the pointer, with a ripple
   on tap and every few seconds. Ported from the kit (KIT.motion.dotGrid). */
import { clamp } from "../easing.ts"
import { seededRandom } from "../random.ts"
import { prefersReducedMotion } from "../reduced-motion.ts"
import { fitCanvas } from "./canvas.ts"

export type Rgb = readonly [number, number, number]

export interface DotGridOptions {
  /** Cell pitch in CSS pixels. Defaults to 14. */
  readonly cell?: number
  /** Space between squares at full size. Defaults to 4. */
  readonly gap?: number
  readonly color?: Rgb
  /** Color the ripple tints squares toward. */
  readonly accent?: Rgb
  /** Noise below this stays empty, 0..1. Defaults to 0.3. */
  readonly threshold?: number
  /** Pointer reach in CSS pixels. Defaults to 120. */
  readonly radius?: number
  /** Fade toward the edges. Defaults to true. */
  readonly vignette?: boolean
  /** A ripple from the centre every 4.5 s. Defaults to true. */
  readonly auto?: boolean
  readonly seed?: number
  /** The element that receives pointer events. Defaults to the canvas's parent. */
  readonly host?: HTMLElement
}

export interface DotGridHandle {
  /** A ripple from (x, y) in CSS pixels, the centre by default. */
  readonly ripple: (x?: number, y?: number) => void
  readonly stop: () => void
}

const RIPPLE_MS = 1400
const AUTO_RIPPLE_MS = 4500

/** Smooth value noise with three octaves, seeded. */
const valueNoise = (seed: number): (x: number, y: number) => number => {
  const r = seededRandom(seed)
  const values = Float32Array.from({ length: 256 }, r)
  const perm = Uint8Array.from({ length: 512 }, (_, i) => i & 255)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const swap = perm[i] ?? 0
    perm[i] = perm[j] ?? 0
    perm[j] = swap
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i] ?? 0
  const at = (x: number, y: number): number => values[perm[(x & 255) + (perm[y & 255] ?? 0)] ?? 0] ?? 0
  const one = (x: number, y: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w
  }
  return (x, y) => one(x, y) * 0.57 + one(x * 2.03, y * 2.03) * 0.29 + one(x * 4.1, y * 4.1) * 0.14
}

/** Run the grid on a canvas sized by CSS. Under reduced motion it draws one still noise field. */
export const dotGrid = (canvas: HTMLCanvasElement, options: DotGridOptions = {}): DotGridHandle => {
  const cell = options.cell ?? 14, gap = options.gap ?? 4, color = options.color ?? [178, 184, 196]
  const accent = options.accent ?? [0, 0, 255], threshold = options.threshold ?? 0.3, radius = options.radius ?? 120
  const vignette = options.vignette ?? true, auto = options.auto ?? true
  const reduce = prefersReducedMotion()
  const noise = valueNoise(options.seed ?? 42), host = options.host ?? canvas.parentElement
  let cols = 0, rows = 0, raf = 0, running = false, visible = true, dead = false
  // Per square: x, y offset and x, y velocity.
  let offsets = new Float32Array(0)
  const pointer = { x: -1e4, y: -1e4 }
  const ripples: Array<{ x: number; y: number; t: number }> = []
  const t0 = performance.now()
  let lastAuto = -1e9

  const frame = (now: number): void => {
    raf = 0
    if (dead || !canvas.isConnected) return
    const fitted = fitCanvas(canvas)
    if (!fitted || !fitted.width || !fitted.height) {
      if (running) raf = requestAnimationFrame(frame)
      return
    }
    const { ctx, width: W, height: H } = fitted
    const t = (now - t0) / 1000
    const c2 = Math.floor(W / cell), r2 = Math.floor(H / cell)
    if (c2 !== cols || r2 !== rows) {
      cols = c2
      rows = r2
      offsets = new Float32Array(cols * rows * 4)
    }
    if (auto && !reduce && now - lastAuto > AUTO_RIPPLE_MS) {
      lastAuto = now
      ripples.push({ x: W / 2, y: H / 2, t: now })
    }
    while (ripples.length && now - (ripples[0]?.t ?? now) > RIPPLE_MS) ripples.shift()
    const ox = (W - cols * cell) / 2 + cell / 2, oy = (H - rows * cell) / 2 + cell / 2, full = cell - gap
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4, bx = ox + i * cell, by = oy + j * cell
        let vg = 1
        if (vignette) {
          const dx = (bx / W - 0.5) * 2, dy = (by / H - 0.5) * 2
          vg = clamp(1.25 - Math.hypot(dx * 0.85, dy) * 0.75)
        }
        let v = noise(i * 0.11 + t * 0.12, j * 0.11 + t * 0.06) * (1 + 0.15 * Math.sin(1.4 * t + 0.17 * i + 0.23 * j))
        v = clamp((v - threshold) / (1 - threshold)) * vg
        let dxo = offsets[k] ?? 0, dyo = offsets[k + 1] ?? 0
        if (!reduce) {
          // Spring the square away from the pointer and back.
          let vx = offsets[k + 2] ?? 0, vy = offsets[k + 3] ?? 0
          const dx = bx - pointer.x, dy = by - pointer.y, d = Math.hypot(dx, dy)
          if (d < radius && d > 0.01) {
            const f = Math.pow(1 - d / radius, 2) * 10
            vx += (dx / d) * f * 0.35
            vy += (dy / d) * f * 0.35
          }
          vx = (vx - dxo * 0.08) * 0.74
          vy = (vy - dyo * 0.08) * 0.74
          dxo += vx
          dyo += vy
          offsets[k] = dxo
          offsets[k + 1] = dyo
          offsets[k + 2] = vx
          offsets[k + 3] = vy
        }
        let wave = 0
        for (const ripple of ripples) {
          const age = (now - ripple.t) / RIPPLE_MS, reach = age * Math.hypot(W, H) * 0.6
          const d = Math.hypot(bx - ripple.x, by - ripple.y)
          wave = Math.max(wave, Math.exp(-Math.pow((d - reach) / 22, 2)) * (1 - age))
        }
        const size = full * Math.max(v, wave * 0.9 * vg)
        if (size < 1.2) continue
        const mix = clamp(wave * 1.3)
        const [r, g, b] = color.map((cv, ci) => Math.round(cv + ((accent[ci] ?? cv) - cv) * mix))
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.beginPath()
        ctx.roundRect(
          bx + dxo - size / 2,
          by + dyo - size / 2,
          size,
          size,
          (size / 2) * (1 - Math.pow(size / full, 2.5)) + 1
        )
        ctx.fill()
      }
    }
    if (running) raf = requestAnimationFrame(frame)
  }

  const start = (): void => {
    if (dead || running || raf) return
    if (reduce) {
      raf = requestAnimationFrame(frame)
      return
    }
    if (visible) {
      running = true
      raf = requestAnimationFrame(frame)
    }
  }
  const pause = (): void => {
    running = false
    cancelAnimationFrame(raf)
    raf = 0
  }
  const move = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = event.clientX - rect.left
    pointer.y = event.clientY - rect.top
  }
  const leave = (): void => {
    pointer.x = pointer.y = -1e4
  }
  const down = (event: PointerEvent): void => {
    move(event)
    ripples.push({ x: pointer.x, y: pointer.y, t: performance.now() })
    lastAuto = performance.now()
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    if (visible) start()
    else pause()
  })
  if (!reduce) {
    host?.addEventListener("pointermove", move)
    host?.addEventListener("pointerleave", leave)
    host?.addEventListener("pointerdown", down)
  }
  observer.observe(canvas)
  start()
  return {
    ripple: (x, y) => {
      const rect = canvas.getBoundingClientRect()
      ripples.push({ x: x ?? rect.width / 2, y: y ?? rect.height / 2, t: performance.now() })
    },
    stop: () => {
      dead = true
      pause()
      observer.disconnect()
      host?.removeEventListener("pointermove", move)
      host?.removeEventListener("pointerleave", leave)
      host?.removeEventListener("pointerdown", down)
    }
  }
}
