import { TAU } from "../../easing.ts"
import { chip, shadow } from "../draw.ts"
import type { Scene } from "../engine.ts"

/** Chip spin: the chip spinning on its axis with three smaller chips orbiting it. */
export const coin: Scene = {
  palette: ["#ffe27a", "#ffd12f", "#3c8aff", "#0000ff"],
  stillAt: 0.7,
  draw(c, t, W, H, p) {
    const R = Math.min(W * 0.2, H * 0.3), cx = W * 0.5 + p.x * W * 0.02, cy = H * 0.48 + p.y * H * 0.02
    shadow(c, cx, cy + R * 1.35, R * 0.9, 0.1)
    c.strokeStyle = "#ececec"
    c.lineWidth = R * 0.03
    c.setLineDash([R * 0.05, R * 0.09])
    c.beginPath()
    c.ellipse(cx, cy - R * 0.08, R * 1.85, R * 0.42, 0, 0, TAU)
    c.stroke()
    c.setLineDash([])
    const orbit = [0, 1, 2].map((k) => {
      const o = t * 0.6 + (k * TAU) / 3, z = Math.sin(o)
      return { k, z, x: cx + Math.cos(o) * R * 1.85, y: cy - R * 0.08 + z * R * 0.42, r: R * 0.3 * (0.82 + 0.22 * z) }
    })
    const small = (o: (typeof orbit)[number]) => chip(c, o.x, o.y, o.r, t * 1.9 + o.k * 1.3, o.z < 0 ? "light" : "main")
    orbit.filter((o) => o.z < 0).forEach(small)
    chip(c, cx, cy, R, t * 1.25 + p.x * 0.6)
    orbit.filter((o) => o.z >= 0).forEach(small)
  }
}
