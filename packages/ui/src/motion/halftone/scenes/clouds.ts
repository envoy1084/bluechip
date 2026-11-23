import { TAU } from "../../easing.ts"
import type { Scene } from "../engine.ts"

interface Cloud {
  readonly y: number
  readonly x: number
  readonly s: number
  /** Drift in canvas widths per second. */
  readonly v: number
  readonly far: boolean
  /** [dx, dy, r] per puff, in cloud units. */
  readonly puffs: ReadonlyArray<readonly [number, number, number]>
}

// Base's footage maps bright to thick, so sunlit cloud tops carry the most ink and the sky stays white.
const CLOUDS: ReadonlyArray<Cloud> = [
  { y: 0.42, x: 0.39, s: 0.55, v: 0.011, far: true, puffs: [[0, 0, 0.42], [0.42, -0.22, 0.5], [0.86, -0.04, 0.4]] },
  { y: 0.36, x: 0.88, s: 0.48, v: 0.013, far: true, puffs: [[0, 0, 0.4], [0.4, -0.2, 0.46], [0.76, 0, 0.36]] },
  {
    y: 0.8,
    x: 0.6,
    s: 1,
    v: 0.024,
    far: false,
    puffs: [[0, 0, 0.36], [0.36, -0.26, 0.48], [0.82, -0.36, 0.58], [1.26, -0.14, 0.46], [1.6, 0, 0.32]]
  },
  { y: 0.9, x: 1.03, s: 0.8, v: 0.03, far: false, puffs: [[0, 0, 0.36], [0.4, -0.28, 0.48], [0.84, -0.06, 0.4]] }
]

/** Clouds (market closed, weekends): clouds drift past a crescent moon. */
export const clouds: Scene = {
  palette: ["#c9d3ff", "#cd99fd", "#3c8aff", "#2a5bff"],
  stillAt: 3,
  draw(c, t, W, H, p) {
    const mx = W * 0.8 - p.x * W * 0.01, my = H * 0.24, mr = H * 0.12
    c.fillStyle = "#1a1a1a"
    c.beginPath()
    c.arc(mx, my, mr, 0, TAU)
    c.fill()
    c.fillStyle = "#fff"
    c.beginPath()
    c.arc(mx + mr * 0.48, my - mr * 0.28, mr * 0.9, 0, TAU)
    c.fill()
    const unit = H * 0.42
    for (const cl of CLOUDS) {
      const span = W + unit * 3.4
      const x = (((cl.x * W + t * cl.v * W + p.x * W * (cl.far ? 0.01 : 0.03)) % span) + span) % span - unit * 1.6
      const y = H * cl.y, s = unit * cl.s, top = y - s * 0.95
      const g = c.createLinearGradient(0, top, 0, y)
      if (cl.far) {
        g.addColorStop(0, "#8c8c8c")
        g.addColorStop(1, "#e2e2e2")
      } else {
        g.addColorStop(0, "#141414")
        g.addColorStop(0.45, "#555")
        g.addColorStop(1, "#c8c8c8")
      }
      c.save()
      c.beginPath()
      c.rect(x - s, top - s, s * 4, y - top + s)
      c.clip()
      c.fillStyle = g
      for (const [dx, dy, r] of cl.puffs) {
        c.beginPath()
        c.arc(x + dx * s, y + dy * s, r * s, 0, TAU)
        c.fill()
      }
      c.restore()
    }
  }
}
