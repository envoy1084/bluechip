import { clamp, smooth, TAU } from "../../easing.ts"
import type { Scene } from "../engine.ts"

interface Fly {
  /** Depth: 1 is nearest. Scales size and opacity. */
  readonly d: number
  readonly ph: number
  readonly sp: number
}

const FLIES: ReadonlyArray<Fly> = [{ d: 0.5, ph: 0.4, sp: 0.85 }, { d: 0.74, ph: 2.9, sp: 0.95 }, {
  d: 1,
  ph: 5.1,
  sp: 1
}]

const flightPath = (t: number, f: Fly): readonly [number, number] => {
  const a = t * f.sp, ph = f.ph
  return [
    0.5 + 0.27 * Math.sin(a * 0.23 + ph) + 0.07 * Math.sin(a * 0.71 + ph * 2.3),
    0.5 + 0.17 * Math.sin(a * 0.31 + ph * 1.7) + 0.05 * Math.sin(a * 1.13 + ph)
  ]
}

const wing = (c: CanvasRenderingContext2D, s: number, fore: boolean): void => {
  c.beginPath()
  if (fore) {
    c.moveTo(0.04 * s, -0.12 * s)
    c.bezierCurveTo(0.3 * s, -0.9 * s, 0.98 * s, -1.02 * s, 1.04 * s, -0.66 * s)
    c.bezierCurveTo(1.08 * s, -0.36 * s, 0.66 * s, -0.08 * s, 0.06 * s, 0.02 * s)
  } else {
    c.moveTo(0.05 * s, 0)
    c.bezierCurveTo(0.62 * s, -0.04 * s, 0.92 * s, 0.34 * s, 0.68 * s, 0.7 * s)
    c.bezierCurveTo(0.46 * s, 0.94 * s, 0.12 * s, 0.66 * s, 0.04 * s, 0.22 * s)
  }
  c.closePath()
}

const SPOTS: ReadonlyArray<readonly [number, number, number]> = [[0.84, -0.68, 0.09], [0.66, -0.8, 0.06], [
  0.92,
  -0.48,
  0.05
], [0.56, 0.5, 0.07]]

const butterfly = (c: CanvasRenderingContext2D, s: number, open: number): void => {
  for (const side of [-1, 1]) {
    c.save()
    c.scale(side * (0.08 + 0.92 * open), 1)
    // Light at the root, darkest along the outer edge: thin pink lines near the body, thick blue at the tips.
    const g = c.createRadialGradient(0.05 * s, -0.05 * s, 0, 0.05 * s, -0.05 * s, 1.1 * s)
    g.addColorStop(0, "#d8d8d8")
    g.addColorStop(0.35, "#8a8a8a")
    g.addColorStop(0.7, "#3a3a3a")
    g.addColorStop(1, "#0e0e0e")
    c.fillStyle = g
    wing(c, s, false)
    c.fill()
    wing(c, s, true)
    c.fill()
    c.fillStyle = "#fff"
    for (const [x, y, r] of SPOTS) {
      c.beginPath()
      c.arc(x * s, y * s, r * s, 0, TAU)
      c.fill()
    }
    c.restore()
  }
  c.fillStyle = "#0a0a0a"
  c.beginPath()
  c.ellipse(0, 0.08 * s, 0.08 * s, 0.52 * s, 0, 0, TAU)
  c.fill()
  c.beginPath()
  c.arc(0, -0.5 * s, 0.11 * s, 0, TAU)
  c.fill()
  c.strokeStyle = "#0a0a0a"
  c.lineWidth = 0.05 * s
  c.lineCap = "round"
  c.beginPath()
  c.moveTo(0, -0.52 * s)
  c.quadraticCurveTo(-0.1 * s, -0.8 * s, -0.26 * s, -0.94 * s)
  c.moveTo(0, -0.52 * s)
  c.quadraticCurveTo(0.1 * s, -0.8 * s, 0.26 * s, -0.94 * s)
  c.stroke()
}

/** Butterflies: three butterflies at different depths, with a fast downstroke, slower recovery and glides. */
export const butterflies: Scene = {
  palette: ["#fea8cd", "#cd99fd", "#3c8aff", "#0000ff"],
  stillAt: 5.7,
  draw(c, t, W, H, p) {
    const base = Math.min(W * 0.2, H * 0.34)
    for (const f of FLIES) {
      const [fx, fy] = flightPath(t, f), [nx] = flightPath(t + 0.08, f)
      const bank = clamp((nx - fx) * 9, -0.45, 0.45)
      // Fast downstroke, slower recovery, and now and then a glide with the wings held open.
      const phase = (t * 2.6 * f.sp + f.ph) % 1
      const beat = phase < 0.3 ? 1 - smooth(phase / 0.3) : smooth((phase - 0.3) / 0.7)
      const glide = smooth((Math.sin(t * 0.5 + f.ph * 3) - 0.35) * 3)
      const open = beat * (1 - glide) + (0.9 + 0.05 * Math.sin(t * 8 + f.ph)) * glide
      const s = base * f.d
      c.save()
      c.globalAlpha = 0.35 + 0.65 * f.d
      c.translate((fx + p.x * 0.04 * f.d) * W, (fy + p.y * 0.04 * f.d) * H + (open - 0.5) * s * 0.16)
      c.rotate(bank)
      butterfly(c, s, open)
      c.restore()
    }
  }
}
