/* The pixel seal forming on Face ID approval: pixels fly in from outside to a disc and dotted ring, a check
   flips white along its stroke, and a shine sweeps across. Ported from the kit (scenes.js, KIT.motion.seal). */
import { clamp, outBack, outCubic, TAU } from "../easing.ts"
import { seededRandom } from "../random.ts"
import { type OneShot, oneShot, type OneShotOptions } from "./canvas.ts"

const N = 23
const CHECK: ReadonlyArray<readonly [number, number]> = [[-0.36, 0.02], [-0.11, 0.27], [0.38, -0.24]]

/** How long the seal takes to form, in seconds. */
export const SEAL_DURATION = 2.2

interface SealPixel {
  readonly x: number
  readonly y: number
  readonly d: number
  readonly color: string
  readonly check: boolean
  /** How far along the check stroke this pixel sits, 0..1 (its flip order). */
  readonly along: number
  readonly sx: number
  readonly sy: number
  readonly delay: number
  readonly spin: number
}

const PIXELS: ReadonlyArray<SealPixel> = (() => {
  const pixels: Array<SealPixel> = [], r = seededRandom(7), m = (N - 1) / 2
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i - m) / m, y = (j - m) / m, d = Math.hypot(x, y), a = Math.atan2(y, x)
      // A disc, a clear gap, then a dotted outer ring: reads as a seal at any size.
      const ring = d > 0.8 && d <= 1.0
      if (!(d <= 0.68 || (ring && Math.round((a / TAU) * 40) % 2 === 0))) continue
      let best = 9, along = 0, run = 0
      for (let s = 0; s < CHECK.length - 1; s++) {
        const [ax, ay] = CHECK[s], [bx, by] = CHECK[s + 1], len = Math.hypot(bx - ax, by - ay)
        const f = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len))
        const dd = Math.hypot(x - ax - f * (bx - ax), y - ay - f * (by - ay))
        if (dd < best) {
          best = dd
          along = run + f * len
        }
        run += len
      }
      const color = ring ? "#3c8aff" : x + y < -0.55 ? "#2a46ff" : "#0000ff"
      const angle = r() * TAU, far = 1.1 + r() * 1.2
      pixels.push({
        x: i,
        y: j,
        d,
        color,
        check: !ring && best < 0.1,
        along: along / run,
        sx: Math.cos(angle) * far,
        sy: Math.sin(angle) * far,
        delay: (1 - d) * 0.32 + r() * 0.28,
        spin: (r() - 0.5) * 3
      })
    }
  }
  return pixels
})()

/** Play the seal on a canvas sized by CSS. */
export const seal = (canvas: HTMLCanvasElement, options: OneShotOptions = {}): OneShot => {
  const m = (N - 1) / 2
  return oneShot(canvas, SEAL_DURATION, (c, W, H, t) => {
    const size = Math.min(W, H) * 0.78, cell = size / N, cx = W / 2, cy = H / 2
    const shine = (t - 1.45) / 0.55
    if (t > 1.4) {
      const e = outCubic((t - 1.4) / 0.8)
      c.strokeStyle = `rgba(60,138,255,${0.35 * (1 - e)})`
      c.lineWidth = cell * 0.5
      c.beginPath()
      c.arc(cx, cy, size * 0.5 + e * size * 0.22, 0, TAU)
      c.stroke()
    }
    for (const q of PIXELS) {
      if (t < q.delay) continue
      const u = outBack((t - q.delay) / 0.62, 1.2)
      const tx = cx + (q.x - m) * cell, ty = cy + (q.y - m) * cell
      const x = tx + q.sx * size * 0.5 * (1 - u), y = ty + q.sy * size * 0.5 * (1 - u)
      let s = cell * 0.86, fill = q.color
      if (q.check) {
        const flip = (t - 1.0 - q.along * 0.38) / 0.16
        if (flip > 0) {
          fill = "#ffffff"
          s *= 1 + 0.35 * Math.sin(Math.PI * clamp(flip))
        }
      }
      if (shine > 0 && shine < 1 && !q.check) {
        const band = (q.x + q.y) / (N * 2) - shine
        if (Math.abs(band) < 0.06) fill = q.d > 0.75 ? "#c9d3ff" : "#3c8aff"
      }
      c.save()
      c.globalAlpha = clamp((t - q.delay) / 0.2)
      c.translate(x, y)
      c.rotate(q.spin * (1 - u))
      c.fillStyle = fill
      c.beginPath()
      c.roundRect(-s / 2, -s / 2, s, s, s * 0.24)
      c.fill()
      c.restore()
    }
  }, options)
}
