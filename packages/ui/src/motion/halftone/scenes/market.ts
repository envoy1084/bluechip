import { clamp, spring, TAU } from "../../easing.ts"
import { seededRandom } from "../../random.ts"
import type { Scene } from "../engine.ts"

const BARS = 12
const CYCLE = 6

/** Market settling: twelve bars spring to new heights every six seconds, a line over their tops. */
export const market: Scene = {
  palette: ["#b6f569", "#66c800", "#3c8aff", "#2a5bff"],
  stillAt: 3.4,
  draw(c, t, W, H, p) {
    const k = Math.floor(t / CYCLE), u = t - k * CYCLE
    const x0 = W * 0.08, gap = W * 0.018, bw = (W * 0.84 - gap * (BARS - 1)) / BARS, base = H * 0.88
    const target = (i: number, cycle: number) =>
      0.18 + 0.52 * (i / (BARS - 1)) + 0.26 * seededRandom(cycle * 977 + i * 131)()
    c.fillStyle = "#e2e2e2"
    c.fillRect(W * 0.06, base + H * 0.02, W * 0.88, H * 0.012)
    const tops: Array<readonly [number, number]> = []
    for (let i = 0; i < BARS; i++) {
      const from = k === 0 ? 0 : target(i, k - 1), to = target(i, k)
      const v = from + (to - from) * spring(u - i * 0.06, 5, 10)
      const h = H * 0.62 * clamp(v - p.y * 0.04, 0.02, 1.08), x = x0 + i * (bw + gap)
      const g = c.createLinearGradient(0, base - h, 0, base)
      g.addColorStop(0, "#161616")
      g.addColorStop(0.45, "#5c5c5c")
      g.addColorStop(1, "#cfcfcf")
      c.fillStyle = g
      c.beginPath()
      c.roundRect(x, base - h, bw, h, Math.min(bw * 0.28, 8))
      c.fill()
      tops.push([x + bw / 2, base - h - H * 0.07])
    }
    c.strokeStyle = "#3a3a3a"
    c.lineWidth = H * 0.018
    c.lineJoin = "round"
    c.lineCap = "round"
    c.beginPath()
    tops.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    c.stroke()
    const [lx, ly] = tops[BARS - 1] ?? [0, 0]
    c.fillStyle = "#111"
    c.beginPath()
    c.arc(lx, ly, H * 0.035, 0, TAU)
    c.fill()
    if (u > 0.9) p.hot = { x: lx, y: ly, r: H * (0.07 + 0.02 * Math.sin(t * 3)) }
  }
}
