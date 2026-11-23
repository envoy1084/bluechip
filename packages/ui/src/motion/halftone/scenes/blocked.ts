import { outCubic, smooth } from "../../easing.ts"
import { face, priceFace, shadow } from "../draw.ts"
import type { Scene } from "../engine.ts"

const CYCLE = 4.4
const HIT = 1.15
const SPARKS = [-2.4, -2.8, 3.14, 2.8, 2.4]

/** Blocked ("Your limit stopped this trade."): a chip rolls into a fence, bounces back and fades. */
export const blocked: Scene = {
  palette: ["#ffe27a", "#ffd12f", "#3c8aff", "#0000ff"],
  stillAt: 1.3,
  draw(c, t, W, H, p) {
    const u = t % CYCLE, v = u - HIT
    const G = H * 0.86, R = H * 0.25, fx = W * 0.66, pw = W * 0.02, gap = W * 0.07
    const shake = v > 0 ? Math.exp(-6 * v) * Math.sin(v * 46) * W * 0.006 : 0
    c.fillStyle = "#e4e4e4"
    c.fillRect(W * 0.04, G, W * 0.92, H * 0.014)
    const x0 = -R, xi = fx - pw / 2 - R * 0.96
    let x: number, hop = 0, roll: number, squash = 1
    if (v < 0) {
      x = x0 + (xi - x0) * Math.pow(u / HIT, 1.25)
      roll = x / R
    } else {
      x = xi - W * 0.2 * (1 - Math.exp(-2.6 * v))
      hop = R * 0.55 * Math.exp(-3.2 * v) * Math.abs(Math.sin(v * 6.5))
      roll = xi / R - (xi - x) / R
      squash = 1 - 0.14 * Math.exp(-18 * v)
    }
    const fade = smooth(u / 0.25) * (1 - smooth((u - 3.7) / 0.5))
    const y = G - R - hop
    if (fade > 0) {
      c.save()
      c.globalAlpha = fade
      shadow(c, x, G + H * 0.01, R * 0.8 * (1 - (hop / R) * 0.6), 0.12)
      c.translate(x, y)
      c.rotate(roll)
      c.scale(squash, 1 / squash)
      priceFace(c, 0, 0, R, R, face(c, 0, 0, R, "dark"))
      c.restore()
    }
    c.fillStyle = "#8c8c8c"
    for (let k = 0; k < 3; k++) {
      const px = fx + k * gap + shake * (1 - k * 0.3), top = G - H * 0.62
      c.beginPath()
      c.moveTo(px - pw / 2, G)
      c.lineTo(px - pw / 2, top + pw)
      c.lineTo(px, top)
      c.lineTo(px + pw / 2, top + pw)
      c.lineTo(px + pw / 2, G)
      c.closePath()
      c.fill()
    }
    c.fillRect(fx - pw + shake, G - H * 0.5, gap * 2 + pw * 2, H * 0.028)
    c.fillRect(fx - pw + shake, G - H * 0.2, gap * 2 + pw * 2, H * 0.028)
    if (v > 0 && v < 0.35) {
      c.strokeStyle = "#202020"
      c.lineWidth = H * 0.016
      c.lineCap = "round"
      const hx = fx - pw / 2 - R * 0.1, hy = G - R, e = outCubic(v / 0.35)
      for (const a of SPARKS) {
        c.beginPath()
        c.moveTo(hx + Math.cos(a) * R * (0.3 + 0.5 * e), hy + Math.sin(a) * R * (0.3 + 0.5 * e))
        c.lineTo(hx + Math.cos(a) * R * (0.5 + 0.6 * e), hy + Math.sin(a) * R * (0.5 + 0.6 * e))
        c.stroke()
      }
    }
    if (v > 0 && v < 0.6) p.hot = { x: fx - pw / 2, y: G - R, r: R * 0.55 * (1 - v / 0.6) + 4, color: "#fc401f" }
  }
}
