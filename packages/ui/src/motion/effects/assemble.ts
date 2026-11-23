/* A new agent's butterfly assembling from pixels, then two wing beats. Ported from the kit (KIT.motion.assemble). */
import { butterflyPixels, hash } from "../../lib/butterfly.ts"
import { clamp, outBack, smooth, TAU } from "../easing.ts"
import { seededRandom } from "../random.ts"
import { type OneShot, oneShot, type OneShotOptions } from "./canvas.ts"

/** How long the butterfly takes to assemble, in seconds. */
export const ASSEMBLE_DURATION = 2.4

/** Play the butterfly for agent `id` assembling on a canvas sized by CSS. */
export const assemble = (canvas: HTMLCanvasElement, id: string, options: OneShotOptions = {}): OneShot => {
  const r = seededRandom(hash(id))
  const pixels = butterflyPixels(id).map((q) => {
    const a = r() * TAU
    return {
      ...q,
      sx: Math.cos(a) * (0.7 + r()),
      sy: Math.sin(a) * (0.7 + r()),
      delay: Math.abs(q.x - 4) * 0.09 + r() * 0.18,
      spin: (r() - 0.5) * 4
    }
  })
  return oneShot(canvas, ASSEMBLE_DURATION, (c, W, H, t) => {
    const cell = Math.min(W / 16, H / 12), cx = W / 2, cy = H / 2
    // Two wing beats once the pixels land, then rest.
    const rest = 1 - clamp((t - 1.15) / 0.9)
    const beat = t > 1.15 ? Math.sin(clamp((t - 1.15) / 0.9) * Math.PI * 2) : 0
    const fold = 1 - 0.55 * Math.abs(beat) * rest
    const lift = -Math.abs(beat) * cell * 0.25 * rest
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, cell * 6)
    g.addColorStop(0, `rgba(60,138,255,${0.12 * smooth((t - 0.8) / 0.6)})`)
    g.addColorStop(1, "rgba(60,138,255,0)")
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
    for (const q of pixels) {
      if (t < q.delay) continue
      const u = outBack((t - q.delay) / 0.7, 1.1)
      const tx = cx + (q.x - 4) * cell * fold, ty = cy + (q.y - 3) * cell + lift
      const x = tx + q.sx * W * 0.45 * (1 - u), y = ty + q.sy * H * 0.45 * (1 - u), s = cell * 0.9
      c.save()
      c.globalAlpha = clamp((t - q.delay) / 0.15)
      c.translate(x, y)
      c.rotate(q.spin * (1 - u))
      c.fillStyle = q.color
      c.beginPath()
      c.roundRect(-s / 2, -s / 2, s, s, s * 0.18)
      c.fill()
      c.restore()
    }
  }, options)
}
