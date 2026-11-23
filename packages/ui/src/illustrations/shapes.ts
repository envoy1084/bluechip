/* The shape vocabulary illustrations are drawn in: a few primitives on a 20 × 20 unit grid, each with a material,
   and hit testing both renderers sample. Ported from the kit (illustrations.js). */

/** The unit grid every object is drawn on. */
export const GRID = 20

export const INK = "#0a0b0d"

/**
 * A material: base color `c`, highlight `hi` and shade `lo` for the pixel light, and `t`, the halftone darkness
 * (0 none … 1 thickest). Flat materials are details that are never shaded; `line: false` keeps the outline from
 * tracing around them (cuts drawn in white).
 */
export interface Material {
  readonly c: string
  readonly hi?: string
  readonly lo?: string
  readonly t: number
  readonly flat?: boolean
  readonly line?: boolean
}

export const MATERIALS = {
  B: { c: "#0000ff", hi: "#3c8aff", lo: "#0000b0", t: 0.8 },
  N: { c: "#0000b0", hi: "#0000ff", lo: "#00007a", t: 0.92 },
  C: { c: "#3c8aff", hi: "#8ab8ff", lo: "#1f5fe0", t: 0.55 },
  Y: { c: "#ffd12f", hi: "#ffe88a", lo: "#e3a600", t: 0.3 },
  O: { c: "#f5a300", hi: "#ffd12f", lo: "#b87800", t: 0.5 },
  G: { c: "#66c800", hi: "#b6f569", lo: "#3f8a00", t: 0.55 },
  L: { c: "#b6f569", hi: "#e2ffbd", lo: "#7fcf2a", t: 0.32 },
  P: { c: "#fea8cd", hi: "#ffd6e8", lo: "#e47aa9", t: 0.3 },
  V: { c: "#cd99fd", hi: "#e8d0ff", lo: "#a46ee6", t: 0.42 },
  T: { c: "#b8a581", hi: "#d9cca9", lo: "#8c7a57", t: 0.45 },
  R: { c: "#fc401f", hi: "#ff8a70", lo: "#c22a0c", t: 0.6 },
  W: { c: "#ffffff", hi: "#ffffff", lo: "#dee1e7", t: 0.14 },
  S: { c: "#eef0f3", hi: "#ffffff", lo: "#b1b7c3", t: 0.2 },
  M: { c: "#b1b7c3", hi: "#dee1e7", lo: "#8a909c", t: 0.38 },
  D: { c: "#5b616e", hi: "#8a909c", lo: "#32353d", t: 0.72 },
  K: { c: INK, flat: true, t: 0.96 },
  w: { c: "#ffffff", flat: true, line: false, t: 0 },
  x: { c: "#ffffff", flat: true, t: 0.16 },
  b: { c: "#0000ff", flat: true, line: false, t: 0.8 }
} as const satisfies Record<string, Material>

export type MaterialKey = keyof typeof MATERIALS

export const material = (key: MaterialKey): Material => MATERIALS[key]

export type Point = readonly [number, number]

/** A rotation by `a` radians around (cx, cy), applied to a shape before testing. */
export interface Turn {
  readonly a: number
  readonly cx: number
  readonly cy: number
}

interface ShapeBase {
  /** The material; absent on shapes only used as clips or cuts. */
  readonly m?: MaterialKey
  readonly at?: Turn
  /** Only the part inside this shape is drawn. */
  readonly clip?: Shape
  /** Holes. */
  readonly cut?: ReadonlyArray<Shape>
}

export type Shape =
  | ShapeBase & {
    readonly k: "rect"
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
    readonly r?: number
  }
  | ShapeBase & {
    readonly k: "ell"
    readonly cx: number
    readonly cy: number
    readonly rx: number
    readonly ry: number
    readonly rot?: number
  }
  | ShapeBase & { readonly k: "poly"; readonly pts: ReadonlyArray<Point> }
  | ShapeBase & { readonly k: "line"; readonly pts: ReadonlyArray<Point>; readonly w: number }
  | ShapeBase & { readonly k: "ring"; readonly cx: number; readonly cy: number; readonly r: number; readonly w: number }

type Extra = Omit<ShapeBase, "m"> & { readonly r?: number; readonly rot?: number }

export const rect = (x: number, y: number, w: number, h: number, m?: MaterialKey, o: Extra = {}): Shape => ({
  k: "rect",
  x,
  y,
  w,
  h,
  ...(m === undefined ? {} : { m }),
  ...o
})
export const disc = (cx: number, cy: number, r: number, m?: MaterialKey, o: Extra = {}): Shape => ({
  k: "ell",
  cx,
  cy,
  rx: r,
  ry: r,
  ...(m === undefined ? {} : { m }),
  ...o
})
export const ell = (cx: number, cy: number, rx: number, ry: number, m: MaterialKey, o: Extra = {}): Shape => ({
  k: "ell",
  cx,
  cy,
  rx,
  ry,
  m,
  ...o
})
export const poly = (pts: ReadonlyArray<Point>, m: MaterialKey, o: Extra = {}): Shape => ({ k: "poly", pts, m, ...o })
export const line = (pts: ReadonlyArray<Point>, w: number, m: MaterialKey, o: Extra = {}): Shape => ({
  k: "line",
  pts,
  w,
  m,
  ...o
})
export const ring = (cx: number, cy: number, r: number, w: number, m: MaterialKey, o: Extra = {}): Shape => ({
  k: "ring",
  cx,
  cy,
  r,
  w,
  m,
  ...o
})
export const turn = (a: number, cx = 10, cy = 10): Turn => ({ a, cx, cy })

const segmentDistance = (x: number, y: number, [ax, ay]: Point, [bx, by]: Point): number => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy
  const u = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0
  return Math.hypot(x - ax - u * dx, y - ay - u * dy)
}

/** Whether (x, y) in grid units falls inside a shape. */
export const inside = (s: Shape, px: number, py: number): boolean => {
  let x = px, y = py
  if (s.at) {
    const c = Math.cos(-s.at.a), n = Math.sin(-s.at.a), dx = x - s.at.cx, dy = y - s.at.cy
    x = s.at.cx + dx * c - dy * n
    y = s.at.cy + dx * n + dy * c
  }
  if (s.clip && !inside(s.clip, x, y)) return false
  if (s.cut && s.cut.some((c) => inside(c, x, y))) return false
  switch (s.k) {
    case "rect": {
      if (x < s.x || y < s.y || x > s.x + s.w || y > s.y + s.h) return false
      if (!s.r) return true
      const qx = Math.max(s.x + s.r - x, 0, x - (s.x + s.w - s.r)),
        qy = Math.max(s.y + s.r - y, 0, y - (s.y + s.h - s.r))
      return qx * qx + qy * qy <= s.r * s.r
    }
    case "ell": {
      let dx = x - s.cx, dy = y - s.cy
      if (s.rot) {
        const c = Math.cos(-s.rot), n = Math.sin(-s.rot)
        ;[dx, dy] = [dx * c - dy * n, dx * n + dy * c]
      }
      return (dx * dx) / (s.rx * s.rx) + (dy * dy) / (s.ry * s.ry) <= 1
    }
    case "poly": {
      let hit = false
      for (let i = 0, j = s.pts.length - 1; i < s.pts.length; j = i++) {
        const [xi, yi] = s.pts[i] ?? [0, 0], [xj, yj] = s.pts[j] ?? [0, 0]
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
      }
      return hit
    }
    case "line": {
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i], b = s.pts[i + 1]
        if (a && b && segmentDistance(x, y, a, b) <= s.w / 2) return true
      }
      return false
    }
    case "ring":
      return Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.r) <= s.w / 2
  }
}

/** The front-most shape at a point (later shapes draw over earlier ones). */
export const hit = (shapes: ReadonlyArray<Shape>, x: number, y: number): Shape | null => {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i]
    if (s && inside(s, x, y)) return s
  }
  return null
}

export type Box = readonly [x0: number, y0: number, x1: number, y1: number]

const boxes = new WeakMap<Shape, Box>()

/** A shape's bounding box, for shading across it. */
export const bounds = (s: Shape): Box => {
  const cached = boxes.get(s)
  if (cached) return cached
  let b: Box
  if (s.k === "rect") b = [s.x, s.y, s.x + s.w, s.y + s.h]
  else if (s.k === "ell") {
    const r = s.rot ? Math.max(s.rx, s.ry) : 0
    b = [s.cx - (r || s.rx), s.cy - (r || s.ry), s.cx + (r || s.rx), s.cy + (r || s.ry)]
  } else if (s.k === "ring") {
    b = [s.cx - s.r - s.w / 2, s.cy - s.r - s.w / 2, s.cx + s.r + s.w / 2, s.cy + s.r + s.w / 2]
  } else {
    const xs = s.pts.map((q) => q[0]), ys = s.pts.map((q) => q[1]), pad = s.k === "line" ? s.w / 2 : 0
    b = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
  }
  boxes.set(s, b)
  return b
}
