/* Canvas plumbing for the pixel moments: sizing to the CSS box and one-shot playback. */
import { prefersReducedMotion } from "../reduced-motion.ts"

export interface FittedCanvas {
  readonly ctx: CanvasRenderingContext2D
  /** CSS pixels. */
  readonly width: number
  readonly height: number
}

/** Size a canvas to its CSS box at the device pixel ratio (at most 2) and clear it. */
export const fitCanvas = (canvas: HTMLCanvasElement): FittedCanvas | undefined => {
  const ctx = canvas.getContext("2d")
  if (!ctx) return undefined
  const dpr = Math.min(window.devicePixelRatio || 1, 2), width = canvas.clientWidth, height = canvas.clientHeight
  const w = Math.round(width * dpr), h = Math.round(height * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  return { ctx, width, height }
}

/** Draws one frame `t` seconds in. */
export type OneShotDraw = (ctx: CanvasRenderingContext2D, width: number, height: number, t: number) => void

export interface OneShotOptions {
  /** Play the first time the canvas scrolls into view. Defaults to true. */
  readonly autoplay?: boolean
  readonly onDone?: () => void
}

export interface OneShot {
  /** Play from the start; under reduced motion, draw the last frame at once. */
  readonly play: () => void
  readonly stop: () => void
}

/** A canvas animation that plays once for `duration` seconds and holds its last frame. */
export const oneShot = (
  canvas: HTMLCanvasElement,
  duration: number,
  draw: OneShotDraw,
  options: OneShotOptions = {}
): OneShot => {
  let raf = 0, t0 = 0
  let observer: IntersectionObserver | undefined
  const paint = (t: number): void => {
    const fitted = fitCanvas(canvas)
    if (fitted && fitted.width && fitted.height) draw(fitted.ctx, fitted.width, fitted.height, t)
  }
  const tick = (now: number): void => {
    if (!canvas.isConnected) return
    const t = (now - t0) / 1000
    paint(Math.min(t, duration))
    if (t < duration) raf = requestAnimationFrame(tick)
    else options.onDone?.()
  }
  const play = (): void => {
    cancelAnimationFrame(raf)
    if (prefersReducedMotion()) {
      raf = requestAnimationFrame(() => {
        paint(duration)
        options.onDone?.()
      })
      return
    }
    raf = requestAnimationFrame((now) => {
      t0 = now
      tick(now)
    })
  }
  const stop = (): void => {
    cancelAnimationFrame(raf)
    observer?.disconnect()
  }
  if (options.autoplay !== false) {
    observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      observer?.disconnect()
      play()
    })
    observer.observe(canvas)
  }
  return { play, stop }
}
