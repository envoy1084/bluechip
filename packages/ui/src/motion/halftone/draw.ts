/* Drawing helpers shared by the halftone scenes: the chip with its price line, its shading and shadow. */
import { TAU } from "../easing.ts"

export type Point = readonly [number, number]

/** The bluechip price line on the mark's 64-unit grid. */
export const LINE: ReadonlyArray<Point> = [[-2, 48], [22, 32], [32, 40], [66, 12]]

/** A point travelling along a polyline, `u` in 0..1. */
export const along = (points: ReadonlyArray<Point>, u: number): Point => {
  const lengths: Array<number> = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1]
    const length = Math.hypot(bx - ax, by - ay)
    lengths.push(length)
    total += length
  }
  let d = u * total, i = 0
  while (i < lengths.length - 1 && d > lengths[i]) {
    d -= lengths[i]
    i++
  }
  const f = Math.min(1, d / lengths[i])
  const [ax, ay] = points[i], [bx, by] = points[i + 1]
  return [ax + (bx - ax) * f, ay + (by - ay) * f]
}

/** Face shading: four stops from the lit top left to the far edge, so a face spans every halftone level. */
export const TONE = {
  main: ["#d2d2d2", "#868686", "#3e3e3e", "#151515"],
  light: ["#ececec", "#c4c4c4", "#a2a2a2", "#848484"],
  dark: ["#a6a6a6", "#4e4e4e", "#262626", "#0e0e0e"]
} as const satisfies Record<string, readonly [string, string, string, string]>

export type Tone = keyof typeof TONE

const STOPS = [0, 0.38, 0.72, 1] as const

export const face = (c: CanvasRenderingContext2D, x: number, y: number, r: number, tone: Tone): CanvasGradient => {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.04, x, y, r * 1.12)
  TONE[tone].forEach((color, i) => g.addColorStop(STOPS[i], color))
  return g
}

/** The chip face with the price line cut through it, wide enough to survive the halftone. */
export const priceFace = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  r: number,
  fill: CanvasGradient | string
): void => {
  c.fillStyle = fill
  c.beginPath()
  c.ellipse(x, y, rx, r, 0, 0, TAU)
  c.fill()
  if (rx < r * 0.25) return
  c.save()
  c.beginPath()
  c.ellipse(x, y, rx, r, 0, 0, TAU)
  c.clip()
  c.strokeStyle = "#fff"
  c.lineWidth = r * 0.3
  c.lineJoin = "round"
  c.lineCap = "round"
  c.beginPath()
  LINE.forEach(([px, py], i) => {
    const X = x + ((px - 32) / 30) * rx, Y = y + ((py - 32) / 30) * r
    if (i) c.lineTo(X, Y)
    else c.moveTo(X, Y)
  })
  c.stroke()
  c.restore()
}

/** A chip turned by `yaw`: the stacked rim, then the face (price line in front, a ring on the back). Returns the face's x. */
export const chip = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  yaw: number,
  tone: Tone = "main"
): number => {
  const sx = Math.cos(yaw), rx = Math.max(Math.abs(sx) * r, 0.6), th = r * 0.11 * Math.sin(yaw)
  c.fillStyle = tone === "main" ? "#121212" : "#8c8c8c"
  for (let i = 0; i <= 6; i++) {
    c.beginPath()
    c.ellipse(x - th + (i / 6) * th * 2, y, rx, r, 0, 0, TAU)
    c.fill()
  }
  const fx = x + th
  if (sx >= 0) {
    priceFace(c, fx, y, rx, r, face(c, fx, y, r, tone))
    return fx
  }
  c.fillStyle = face(c, fx, y, r, tone)
  c.beginPath()
  c.ellipse(fx, y, rx, r, 0, 0, TAU)
  c.fill()
  c.strokeStyle = "rgba(255,255,255,.6)"
  c.lineWidth = r * 0.09
  c.beginPath()
  c.ellipse(fx, y, rx * 0.66, r * 0.66, 0, 0, TAU)
  c.stroke()
  return fx
}

/** A soft ground shadow. */
export const shadow = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha = 0.12): void => {
  c.fillStyle = `rgba(0,0,0,${alpha})`
  c.beginPath()
  c.ellipse(x, y, rx, rx * 0.11, 0, 0, TAU)
  c.fill()
}
