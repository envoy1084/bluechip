/* Agent butterflies: a mirrored pixel butterfly from an agent's id, ported exactly from the kit (core.js), so the
   same name hatches the same butterfly in the kit, the app and on every device. */

export interface ButterflyPixel {
  readonly x: number
  readonly y: number
  readonly color: string
}

/** The grid a butterfly is drawn on: 9 columns by 7 rows. */
export const BUTTERFLY_WIDTH = 9
export const BUTTERFLY_HEIGHT = 7

const INK = "#0a0b0d"
// The left half of the wings; the right half mirrors it around the body in column 4.
const MASK = ["0110", "1111", "1111", "0111", "0111", "0110", "0010"]
/** Main and accent color pairs, picked by the id's hash. */
export const BUTTERFLY_COLORS: ReadonlyArray<readonly [main: string, accent: string]> = [
  ["#2a5bff", "#3c8aff"],
  ["#fea8cd", "#cd99fd"],
  ["#66c800", "#b6f569"],
  ["#ffd12f", "#f5a300"],
  ["#3c8aff", "#fea8cd"],
  ["#cd99fd", "#2a5bff"]
]

/** 32-bit FNV-1a over the id's code points (the first UTF-16 unit of each, as the kit does). */
export const hash = (id: string): number => {
  let h = 2166136261
  for (const ch of id) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** The butterfly's pixels for an id, wings first (each pixel then its mirror), then the body and antennae. */
export const butterflyPixels = (id: string): ReadonlyArray<ButterflyPixel> => {
  let h = hash(id)
  const [main, accent] = BUTTERFLY_COLORS[h % BUTTERFLY_COLORS.length]
  const pixels: Array<ButterflyPixel> = []
  for (let y = 0; y < BUTTERFLY_HEIGHT; y++) {
    for (let x = 0; x < 4; x++) {
      if (MASK[y][x] !== "1") continue
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
      // Drop about a quarter of the wing pixels, never the column next to the body.
      if ((h & 7) < 2 && x !== 3) continue
      const color = (h >>> 8) % 4 === 0 ? accent : main
      pixels.push({ x, y, color }, { x: 8 - x, y, color })
    }
  }
  for (let y = 1; y <= 5; y++) pixels.push({ x: 4, y, color: INK })
  pixels.push({ x: 3, y: 0, color: INK }, { x: 5, y: 0, color: INK })
  return pixels
}

/** Paint the butterfly at one canvas pixel per grid cell; scale it up in CSS with `image-rendering: pixelated`. */
export const paintButterfly = (canvas: HTMLCanvasElement, id: string): void => {
  canvas.width = BUTTERFLY_WIDTH
  canvas.height = BUTTERFLY_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, BUTTERFLY_WIDTH, BUTTERFLY_HEIGHT)
  for (const pixel of butterflyPixels(id)) {
    ctx.fillStyle = pixel.color
    ctx.fillRect(pixel.x, pixel.y, 1, 1)
  }
}
