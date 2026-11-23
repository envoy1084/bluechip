import { outCubic, smooth, spring, TAU } from "../../easing.ts"
import type { HotSpot, Scene } from "../engine.ts"

// [x share, height share, delay s, size] for each flower.
const BLOOMS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.14, 0.6, 0.0, 0.9],
  [0.3, 0.76, 0.3, 1.1],
  [0.5, 0.82, 0.12, 1.2],
  [0.69, 0.7, 0.45, 1],
  [0.86, 0.62, 0.22, 0.95]
]
const LEAVES: ReadonlyArray<readonly [number, number]> = [[0.3, -1], [0.48, 1]]

/** Garden bloom ("Limits locked"): flowers grow and open inside a fence held by a padlock. */
export const garden: Scene = {
  palette: ["#b6f569", "#66c800", "#cd99fd", "#0000ff"],
  stillAt: 5.5,
  draw(c, t, W, H, p) {
    const G = H * 0.95, FY = H * 0.6, unit = Math.min(W * 0.62, H)
    c.fillStyle = "#e4e4e4"
    c.beginPath()
    c.ellipse(W * 0.5, G + H * 0.1, W * 0.7, H * 0.2, 0, 0, TAU)
    c.fill()
    let hot: HotSpot | null = null
    for (const [i, [fx, fh, delay, size]] of BLOOMS.entries()) {
      const g = outCubic((t - delay) / 1.7), b = spring((t - delay - 1.4) / 1.1, 5, 8)
      if (g <= 0) continue
      const s = unit * 0.1 * size, sway = Math.sin(t * 1.1 + i * 1.7) * s * 0.22 * g + p.x * s * 0.4
      const x = W * fx, topY = G - H * fh * g, tx = x + sway
      c.strokeStyle = "#8e8e8e"
      c.lineWidth = s * 0.14
      c.lineCap = "round"
      c.beginPath()
      c.moveTo(x, G)
      c.quadraticCurveTo(x - sway * 0.3, (G + topY) / 2, tx, topY)
      c.stroke()
      c.fillStyle = "#969696"
      for (const [f, dir] of LEAVES) {
        if (g < f + 0.15) continue
        const ly = G - (G - topY) * f, lx = x + sway * f * f
        c.beginPath()
        c.ellipse(lx + dir * s * 0.45, ly, s * 0.5 * smooth((g - f - 0.15) * 4), s * 0.15, dir * -0.55, 0, TAU)
        c.fill()
      }
      if (b <= 0.02) {
        if (g > 0.6) {
          c.fillStyle = "#2a2a2a"
          c.beginPath()
          c.ellipse(tx, topY, s * 0.22, s * 0.3, 0, 0, TAU)
          c.fill()
        }
        continue
      }
      const rot = i + t * 0.05
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + rot, d = s * 0.6 * b
        c.fillStyle = "#1c1c1c"
        c.beginPath()
        c.ellipse(tx + Math.cos(a) * d, topY + Math.sin(a) * d, s * 0.5 * b, s * 0.2 * b, a, 0, TAU)
        c.fill()
      }
      c.fillStyle = "#5a5a5a"
      c.beginPath()
      c.arc(tx, topY, s * 0.38 * b, 0, TAU)
      c.fill()
      c.fillStyle = "#0a0a0a"
      c.beginPath()
      c.arc(tx, topY, s * 0.16 * b, 0, TAU)
      c.fill()
      const pop = (t - delay - 1.4) / 0.5
      if (pop > 0 && pop < 1) hot = { x: tx, y: topY, r: s * 0.8 * (1 - pop) }
    }
    // The fence stands in front: the flowers grow inside it.
    const pw = W * 0.02, n = Math.max(6, Math.round(W / 62)), step = (W * 0.94 - pw) / (n - 1)
    c.fillStyle = "#585858"
    for (let k = 0; k < n; k++) {
      const x = W * 0.03 + k * step
      c.beginPath()
      c.moveTo(x, G)
      c.lineTo(x, FY + pw)
      c.lineTo(x + pw / 2, FY)
      c.lineTo(x + pw, FY + pw)
      c.lineTo(x + pw, G)
      c.closePath()
      c.fill()
    }
    c.fillRect(W * 0.02, FY + H * 0.1, W * 0.96, H * 0.026)
    c.fillRect(W * 0.02, G - H * 0.11, W * 0.96, H * 0.026)
    // A padlock where the rails meet.
    const lx = W * 0.5, ly = FY + H * 0.12, ls = unit * 0.075
    c.strokeStyle = "#0a0a0a"
    c.lineWidth = ls * 0.3
    c.beginPath()
    c.arc(lx, ly - ls * 0.3, ls * 0.55, Math.PI, 0)
    c.stroke()
    c.fillStyle = "#0a0a0a"
    c.beginPath()
    c.roundRect(lx - ls * 0.85, ly - ls * 0.35, ls * 1.7, ls * 1.35, ls * 0.28)
    c.fill()
    c.fillStyle = "#fff"
    c.beginPath()
    c.arc(lx, ly + ls * 0.22, ls * 0.2, 0, TAU)
    c.fill()
    if (hot) p.hot = hot
  }
}
