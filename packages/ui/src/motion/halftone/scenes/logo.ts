import { smooth, TAU } from "../../easing.ts"
import { along, chip, LINE, type Point, shadow } from "../draw.ts"
import type { Scene } from "../engine.ts"

/** Rising chip: the logo chip turning slowly, rings widening behind it, a glint running up the price line. */
export const logo: Scene = {
  palette: ["#c9d3ff", "#3c8aff", "#0000ff", "#0000b0"],
  stillAt: 2.2,
  draw(c, t, W, H, p) {
    const R = Math.min(W * 0.36, H * 0.36), rise = Math.sin(t * 0.8) * R * 0.07
    const cx = W * 0.5 + p.x * W * 0.02, cy = H * 0.47 - rise + p.y * H * 0.02
    shadow(c, cx, H * 0.47 + R * 1.2, R * (0.72 - rise / R), 0.1)
    // Rings widening out behind the chip, like ripples from a rising price. Light enough to stay thin.
    c.lineWidth = R * 0.07
    for (let k = 0; k < 4; k++) {
      const u = (t * 0.12 + k / 4) % 1, v = Math.round(200 + 52 * u)
      c.strokeStyle = `rgb(${v},${v},${v})`
      c.beginPath()
      c.ellipse(cx, cy, R * (1.2 + u * 1.6), R * (1.2 + u * 1.6), 0, 0, TAU)
      c.stroke()
    }
    const yaw = 0.45 * Math.sin(t * 0.45) + p.x * 0.3
    const fx = chip(c, cx, cy, R, yaw)
    const u = (t * 0.3) % 1.6, rx = R * Math.cos(yaw)
    if (u < 1) {
      const points = LINE.map(([px, py]): Point => [fx + ((px - 32) / 30) * rx, cy + ((py - 32) / 30) * R])
      const [hx, hy] = along(points, smooth(u))
      p.hot = { x: hx, y: hy, r: R * 0.2 }
    }
  }
}
