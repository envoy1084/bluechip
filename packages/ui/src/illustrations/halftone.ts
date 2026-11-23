/* The halftone renderer: samples an object's shapes at the halftone cell grid, turns each material into a
   darkness, and lets the line-halftone engine draw capsules in the object's own palette. */
import { along } from "../motion/halftone/draw.ts"
import type { Scene } from "../motion/halftone/engine.ts"
import { type IllustrationName, OBJECTS } from "./objects.ts"
import { bounds, GRID, hit, type MaterialKey, MATERIALS, type Shape } from "./shapes.ts"

// Four sub-samples per cell give anti-aliased coverage at the shapes' edges.
const SUB: ReadonlyArray<readonly [number, number]> = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]

const scenes = new Map<IllustrationName, Scene>()

/** The halftone scene for an object. Its still frame is t = 0. */
export const illustrationScene = (name: IllustrationName): Scene => {
  const cached = scenes.get(name)
  if (cached) return cached
  const obj = OBJECTS[name]
  const tones: Partial<Record<MaterialKey, number>> = "tones" in obj ? obj.tones : {}
  const tone = (m: MaterialKey): number => tones[m] ?? MATERIALS[m].t
  const scene: Scene = {
    palette: obj.palette,
    stillAt: 0,
    draw(ctx, t, W, _H, p) {
      const cols = ctx.canvas.width, rows = ctx.canvas.height
      const unit = (Math.min(cols, rows) / GRID) * 0.96
      const ox = (cols - unit * GRID) / 2 + p.x * unit * 0.35
      const oy = (rows - unit * GRID) / 2 + p.y * unit * 0.35 + Math.sin(t * 1.2) * unit * 0.3
      const shapes = obj.draw(t)
      const cell: Array<Shape | null> = new Array<Shape | null>(cols * rows).fill(null)
      const cover = new Float32Array(cols * rows)
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          let first: Shape | null = null, hits = 0
          for (const [fx, fy] of SUB) {
            const s = hit(shapes, (i + fx - ox) / unit, (j + fy - oy) / unit)
            if (s) {
              hits++
              first ??= s
            }
          }
          cell[j * cols + i] = hit(shapes, (i + 0.5 - ox) / unit, (j + 0.5 - oy) / unit) ?? first
          cover[j * cols + i] = hits / 4
        }
      }
      const empty = (i: number, j: number) => i < 0 || j < 0 || i >= cols || j >= rows || !cell[j * cols + i]
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const s = cell[j * cols + i]
          if (!s?.m) continue
          let d = tone(s.m)
          if (d <= 0) continue
          if (!("flat" in MATERIALS[s.m])) {
            // Same light as the pixel version: lighter toward the top left of each shape, darker toward its bottom right.
            const [x0, y0, x1, y1] = bounds(s), x = (i + 0.5 - ox) / unit, y = (j + 0.5 - oy) / unit
            const u = ((x - x0) / Math.max(1, x1 - x0) + (y - y0) / Math.max(1, y1 - y0)) / 2
            d += (u - 0.45) * 0.3
            if (empty(i, j - 1)) d -= 0.06
            if (empty(i, j + 1) || empty(i + 1, j)) d += 0.1
          }
          d = Math.max(0.08, Math.min(1, d)) * Math.max(0.4, cover[j * cols + i] ?? 0)
          const g = Math.round((1 - d) * 255)
          ctx.fillStyle = `rgb(${g},${g},${g})`
          ctx.fillRect(i, j, 1, 1)
        }
      }
      if (t <= 0) return
      const k = W / cols
      if ("glint" in obj && "path" in obj) {
        const u = (t * 0.3) % 1.6
        if (u < 1) {
          const [hx, hy] = along(obj.path(), u)
          p.hot = { x: (hx * unit + ox) * k, y: (hy * unit + oy) * k, r: unit * k * 2.2 }
        }
      }
      if ("scan" in obj) {
        const sy = 4 + ((t * 0.45) % 1) * 12
        p.hot = { x: (10 * unit + ox) * k, y: (sy * unit + oy) * k, r: unit * k * 1.8, color: "#3c8aff" }
      }
    }
  }
  scenes.set(name, scene)
  return scene
}
