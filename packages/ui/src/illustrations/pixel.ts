/* The pixel renderer: samples an object's shapes at the 20 × 20 pixel centres, shades every material from one
   light (highlight on top edges, one darker shade on bottom and right edges), adds a 1 px ink outline, and paints
   at a whole-number scale so every edge stays sharp. */
import { type IllustrationName, OBJECTS } from "./objects.ts"
import { GRID, hit, INK, type MaterialKey, MATERIALS } from "./shapes.ts"

/** The 20 × 20 colors of an object at time `t`, row by row; `null` is transparent. */
export const pixels = (name: IllustrationName, t = 0): ReadonlyArray<string | null> => {
  const shapes = OBJECTS[name].draw(t)
  const mats: Array<MaterialKey | null> = []
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) mats.push(hit(shapes, i + 0.5, j + 0.5)?.m ?? null)
  }
  const at = (i: number, j: number): MaterialKey | null =>
    i < 0 || j < 0 || i >= GRID || j >= GRID ? null : mats[j * GRID + i] ?? null
  const out: Array<string | null> = []
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const m = at(i, j)
      if (!m) {
        const traced = [at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1)].some((n) =>
          n !== null && !("line" in MATERIALS[n] && MATERIALS[n].line === false)
        )
        out.push(traced ? INK : null)
        continue
      }
      const mat = MATERIALS[m]
      if (!("hi" in mat)) {
        out.push(mat.c)
        continue
      }
      const top = at(i, j - 1) !== m, bottom = at(i, j + 1) !== m, right = at(i + 1, j) !== m, left = at(i - 1, j) !== m
      out.push(top && !bottom ? mat.hi : bottom && !top ? mat.lo : right && !left && !top ? mat.lo : mat.c)
    }
  }
  return out
}

/** Paint an object as pixel art on a canvas `size` CSS pixels square, at a whole-number scale. */
export const paintPixels = (canvas: HTMLCanvasElement, name: IllustrationName, size: number): void => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const px = Math.round(size * dpr)
  canvas.width = canvas.height = px
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const unit = Math.max(1, Math.floor(px / GRID)), off = Math.floor((px - unit * GRID) / 2)
  const grid = pixels(name)
  ctx.clearRect(0, 0, px, px)
  grid.forEach((color, k) => {
    if (!color) return
    ctx.fillStyle = color
    ctx.fillRect(off + (k % GRID) * unit, off + Math.floor(k / GRID) * unit, unit, unit)
  })
}
