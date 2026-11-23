import { clamp, TAU } from "../../easing.ts"
import { seededRandom } from "../../random.ts"
import type { Scene } from "../engine.ts"

const STARS = (() => {
  const r = seededRandom(42)
  return Array.from({ length: 230 }, () => ({ a: r() * TAU, z: r(), sp: 0.7 + r() * 0.6 }))
})()

/** Warp (sending a trade or a withdrawal): streaks fly out of a bright centre, surging now and then. */
export const warp: Scene = {
  palette: ["#c9d3ff", "#cd99fd", "#3c8aff", "#0000ff"],
  stillAt: 2.4,
  draw(c, t, W, H, p) {
    const cx = W * 0.5 + p.x * W * 0.05, cy = H * 0.5 + p.y * H * 0.05, D = Math.hypot(W, H) * 0.55
    // Distance travelled: a steady cruise with a surge every few seconds, as if a transfer just left.
    const travel = t * 0.32 + 0.18 * Math.max(0, t - 0.5) + 0.12 * Math.sin(t * 1.2)
    c.lineCap = "round"
    for (const s of STARS) {
      const z = 1 - ((s.z + travel * s.sp) % 1)
      const zt = Math.min(1, z + 0.05 + 0.04 * (1 - z))
      const r1 = (0.05 * D) / Math.max(z, 0.04), r0 = (0.05 * D) / zt
      if (r0 > D * 1.3) continue
      const near = 1 - z, v = Math.round(255 * (1 - (0.15 + 0.85 * near) * clamp((1 - z) * 3)))
      c.strokeStyle = `rgb(${v},${v},${v})`
      c.lineWidth = 1 + near * near * D * 0.018
      c.beginPath()
      c.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0)
      c.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1)
      c.stroke()
    }
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, D * 0.16)
    g.addColorStop(0, "#fff")
    g.addColorStop(1, "rgba(255,255,255,0)")
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
    const pulse = (t * 0.6) % 1
    p.hot = { x: cx, y: cy, r: D * 0.05 * (1 - pulse) + 4, color: "#0000ff" }
  }
}
