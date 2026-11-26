/* The illustration objects. Each is ONE drawing: a list of shapes on the 20 × 20 grid, each with a material.
   `pixel.ts` and `halftone.ts` both read it, so the two styles can never drift apart. Ported from the kit
   (illustrations.js); `draw(t)` takes seconds for the objects that move in halftone. */
import type { Palette } from "../motion/halftone/engine.ts"
import { LEDGER_OBJECTS } from "./ledger-objects.ts"
import { disc, ell, line, type MaterialKey, type Point, poly, rect, ring, type Shape, turn } from "./shapes.ts"

export interface IllustrationObject {
  readonly label: string
  /** Where it appears in the product. */
  readonly usedFor: string
  /** Halftone inks, lightest to darkest. */
  readonly palette: Palette
  /** Halftone darkness per material, overriding the material's own. */
  readonly tones?: Partial<Record<MaterialKey, number>>
  /** A gold glint runs along `path` in halftone. */
  readonly glint?: boolean
  /** A scan line sweeps down in halftone. */
  readonly scan?: boolean
  readonly draw: (t: number) => ReadonlyArray<Shape>
  readonly path?: () => ReadonlyArray<Point>
}

const mapPoints = (points: ReadonlyArray<Point>, f: (p: Point) => Point): ReadonlyArray<Point> => points.map(f)

const flower = (cx: number, cy: number, petal: MaterialKey, heart: MaterialKey): ReadonlyArray<Shape> => [
  disc(cx - 1.25, cy, 1.25, petal),
  disc(cx + 1.25, cy, 1.25, petal),
  disc(cx, cy - 1.25, 1.25, petal),
  disc(cx, cy + 1.25, 1.25, petal),
  disc(cx, cy, 0.95, heart)
]

/** A stack of `n` chips seen slightly from above: bands alternate side colors under one top face. */
const stack = (
  cx: number,
  top: number,
  rx: number,
  ry: number,
  n: number,
  h: number,
  faceKey: MaterialKey,
  sides: ReadonlyArray<MaterialKey>
): ReadonlyArray<Shape> => {
  const out: Array<Shape> = []
  for (let k = n - 1; k >= 0; k--) {
    const y = top + k * h, side = sides[k % sides.length] ?? faceKey
    out.push(ell(cx, y + h, rx, ry, side), rect(cx - rx, y, rx * 2, h, side))
  }
  out.push(ell(cx, top, rx, ry, faceKey))
  return out
}

const LOGO: ReadonlyArray<Point> = [[-2, 48], [22, 32], [32, 40], [66, 12]]
const logoPath = (): ReadonlyArray<Point> => {
  const s = 7.6 / 30
  return mapPoints(LOGO, ([x, y]) => [10 + (x - 32) * s, 10 + (y - 32) * s])
}

const BLUE: Palette = ["#c9d3ff", "#3c8aff", "#2a5bff", "#1a3bc2"]
const COIN: Palette = ["#ffe27a", "#ffd12f", "#3c8aff", "#2a5bff"]
const MEADOW: Palette = ["#b6f569", "#66c800", "#3c8aff", "#2a5bff"]
const BLOOM: Palette = ["#fea8cd", "#cd99fd", "#3c8aff", "#2a5bff"]

export const OBJECTS = {
  chip: {
    label: "Chip",
    usedFor: "Brand moments, loading, the badge behind a stock",
    palette: BLUE,
    tones: { C: 0.36 },
    draw: () => [
      disc(10.6, 10.6, 7.8, "N"),
      disc(10, 10, 7.8, "B"),
      rect(9, 3, 2, 2.4, "w"),
      rect(9, 14.6, 2, 2.4, "w"),
      rect(3, 9, 2.4, 2, "w"),
      rect(14.6, 9, 2.4, 2, "w"),
      disc(10, 10, 3.9, "C")
    ]
  },
  "chip-stack": {
    label: "Chip stack",
    usedFor: "Portfolio total, deposit received",
    palette: COIN,
    tones: { B: 0.72, N: 0.9, C: 0.55, Y: 0.3, O: 0.45 },
    draw: () => [
      ...stack(7.5, 4, 5, 1.8, 6, 2, "C", ["B", "N"]),
      ell(7.5, 4, 2.5, 0.8, "B"),
      ...stack(13, 10, 5, 1.8, 3, 2, "Y", ["O", "Y"]),
      ell(13, 10, 2.5, 0.8, "O")
    ]
  },
  "rising-chip": {
    label: "Rising chip",
    usedFor: "The logo object: splash, first run, success",
    palette: BLUE,
    glint: true,
    draw: () => [
      disc(10.5, 10.5, 7.6, "N"),
      disc(10, 10, 7.6, "B"),
      line(logoPath(), 1.6, "w", { clip: disc(10.25, 10.25, 8) })
    ],
    path: logoPath
  },
  butterfly: {
    label: "Butterfly",
    usedFor: "Agents: no agents yet, agent created",
    palette: BLOOM,
    tones: { P: 0.2, C: 0.5 },
    draw: (t) => {
      const f = 1 - 0.42 * Math.abs(Math.sin(t * 2.6))
      const sx = (x: number) => 10 + (x - 10) * f
      const wing = (side: number): ReadonlyArray<Shape> => {
        const r = side * 0.55
        return [
          ell(sx(10 + side * 4.1), 7.2, 4.2 * f, 3.6, "B", { rot: -r }),
          disc(sx(10 + side * 4.9), 6.4, 1.3 * f + 0.2, "C"),
          ell(sx(10 + side * 3.1), 13.1, 2.8 * f, 2.6, "P", { rot: r })
        ]
      }
      return [
        ...wing(-1),
        ...wing(1),
        line([[10, 5.5], [10, 15.4]], 1.4, "K"),
        line([[9.5, 5], [7, 2]], 0.9, "K"),
        line([[10.5, 5], [13, 2]], 0.9, "K")
      ]
    }
  },
  garden: {
    label: "Garden",
    usedFor: "Limits overview: your portfolio grows inside its limits",
    palette: ["#b6f569", "#66c800", "#fea8cd", "#2a5bff"],
    tones: { P: 0.68, V: 0.68, Y: 0.68, O: 0.95, G: 0.45, L: 0.2, W: 0.95, T: 0.95 },
    draw: (t) => {
      const sway = Math.sin(t * 1.4) * 0.35
      return [
        line([[5.5, 14], [5.5 + sway, 7.5]], 1, "G"),
        line([[10, 14], [10 - sway, 5.5]], 1, "G"),
        line([[14.5, 14], [14.5 + sway, 8]], 1, "G"),
        ell(7.4, 10.2, 1.7, 0.8, "L", { rot: -0.6 }),
        ell(12.4, 9.6, 1.7, 0.8, "L", { rot: 0.6 }),
        ...flower(5.5 + sway, 7, "P", "Y"),
        ...flower(10 - sway, 4.6, "Y", "O"),
        ...flower(14.5 + sway, 7.6, "V", "Y"),
        rect(1, 12, 18, 1.6, "T"),
        rect(1, 15.6, 18, 1.6, "T"),
        ...[1.5, 5.5, 9.5, 13.5].map((x) =>
          poly([[x, 11.4], [x + 1.5, 10], [x + 3, 11.4], [x + 3, 18.5], [x, 18.5]], "W")
        ),
        poly([[17.5, 11.4], [18.5, 10.4], [18.5, 18.5], [17.5, 18.5]], "W")
      ]
    }
  },
  fence: {
    label: "Fence",
    usedFor: "A limit stopped a trade; editing limits",
    palette: BLUE,
    tones: { W: 0.2, Y: 0.36 },
    draw: () => [
      rect(1, 7, 18, 2, "Y"),
      rect(1, 13, 18, 2, "Y"),
      ...[2, 6.5, 11, 15.5].map((x) => poly([[x, 4.6], [x + 1.25, 3], [x + 2.5, 4.6], [x + 2.5, 18], [x, 18]], "B"))
    ]
  },
  passkey: {
    label: "Face ID",
    usedFor: "Create your account and sign in with Face ID",
    palette: BLUE,
    tones: { Y: 0.45, b: 0.75 },
    scan: true,
    draw: () => [
      line([[2.5, 6.5], [2.5, 2.5], [6.5, 2.5]], 1.6, "b"),
      line([[13.5, 2.5], [17.5, 2.5], [17.5, 6.5]], 1.6, "b"),
      line([[2.5, 13.5], [2.5, 17.5], [6.5, 17.5]], 1.6, "b"),
      line([[13.5, 17.5], [17.5, 17.5], [17.5, 13.5]], 1.6, "b"),
      disc(10, 10, 4.6, "Y"),
      rect(7.9, 8, 1.2, 1.8, "K"),
      rect(10.9, 8, 1.2, 1.8, "K"),
      line([[8.2, 12], [9.2, 12.9], [10.8, 12.9], [11.8, 12]], 1, "K")
    ]
  },
  lock: {
    label: "Lock",
    usedFor: "Limits locked with Face ID",
    palette: COIN,
    tones: { M: 0.6, Y: 0.45 },
    draw: () => [
      ring(10, 8, 4, 2, "M", { clip: rect(0, 0, 20, 9.5) }),
      rect(5, 8.5, 2, 2, "M"),
      rect(13, 8.5, 2, 2, "M"),
      rect(3.5, 9, 13, 9.5, "Y", { r: 1.4 }),
      disc(10, 12.6, 1.3, "K"),
      rect(9.4, 13, 1.2, 2.6, "K")
    ]
  },
  key: {
    label: "Key",
    usedFor: "Adding a device, account recovery",
    palette: COIN,
    tones: { Y: 0.5 },
    draw: () => {
      const at = turn(-Math.PI / 4)
      return [
        ring(4.6, 10, 3.2, 2.4, "Y", { at }),
        rect(7.6, 9, 10.4, 2, "Y", { at }),
        rect(13.4, 10.5, 1.7, 2.6, "Y", { at }),
        rect(16.2, 10.5, 1.7, 2, "Y", { at })
      ]
    }
  },
  shield: {
    label: "Shield",
    usedFor: "Fair price check, security",
    palette: MEADOW,
    tones: { B: 0.82, C: 0.6 },
    draw: () => {
      const pts: ReadonlyArray<Point> = [
        [10, 1.8],
        [16.6, 4.2],
        [16.6, 9.6],
        [15.6, 13],
        [13, 16.2],
        [10, 18.4],
        [
          7,
          16.2
        ],
        [4.4, 13],
        [3.4, 9.6],
        [3.4, 4.2]
      ]
      return [
        poly(pts, "B"),
        poly(pts, "C", { clip: rect(0, 0, 10, 20) }),
        line([[6.8, 10], [9, 12.3], [13.4, 7.6]], 1.8, "w")
      ]
    }
  },
  calendar: {
    label: "Calendar",
    usedFor: "Weekly buyer agent, scheduled buys",
    palette: BLUE,
    tones: { W: 0.18, S: 0.32, D: 0.9, B: 0.7 },
    draw: () => {
      const cells: Array<Shape> = []
      for (const y of [10, 13, 16]) for (const x of [5, 9, 13]) cells.push(rect(x, y, 2, 2, x === 9 ? "B" : "S"))
      return [
        rect(3, 4, 14, 15, "W", { r: 1 }),
        rect(3, 4, 14, 4, "B", { r: 1 }),
        rect(3, 6, 14, 2, "B"),
        rect(6, 2, 2, 4, "D", { r: 0.6 }),
        rect(12, 2, 2, 4, "D", { r: 0.6 }),
        ...cells
      ]
    }
  },
  scales: {
    label: "Scales",
    usedFor: "Rebalancer agent, target mix",
    palette: ["#fff4c7", "#ffd12f", "#b8a581", "#32353d"],
    tones: { Y: 0.36, D: 0.85, B: 0.7, C: 0.6 },
    draw: (t) => {
      const a = Math.sin(t * 1.1) * 0.09, dy = Math.sin(a) * 5.5
      const pan = (cx: number, y: number, chipKey: MaterialKey): ReadonlyArray<Shape> => [
        line([[cx, 6.6], [cx - 2.4, y]], 0.9, "D"),
        line([[cx, 6.6], [cx + 2.4, y]], 0.9, "D"),
        disc(cx, y - 1.4, 1.5, chipKey),
        ell(cx, y, 3, 2.2, "Y", { clip: rect(0, y, 20, 5) })
      ]
      return [
        rect(9, 5, 2, 12, "D"),
        rect(6, 16.5, 8, 2, "D", { r: 0.8 }),
        line([[4.5, 6], [15.5, 6]], 1.7, "D", { at: turn(a, 10, 6) }),
        ...pan(4.5, 12 - dy, "B"),
        ...pan(15.5, 12 + dy, "C"),
        disc(10, 4.6, 1.4, "Y")
      ]
    }
  },
  "stop-sign": {
    label: "Stop sign",
    usedFor: "Stop-loss guard agent",
    palette: ["#fea8cd", "#fc401f", "#d93a1c", "#0a0b0d"],
    tones: { R: 0.62, x: 0.2 },
    draw: () => {
      const oct: ReadonlyArray<Point> = [[7, 2], [13, 2], [17, 6], [17, 12], [13, 16], [7, 16], [3, 12], [3, 6]]
      const inner = mapPoints(oct, ([x, y]) => [10 + (x - 10) * 0.82, 9 + (y - 9) * 0.82])
      return [rect(9, 15, 2, 4, "M"), poly(oct, "x"), poly(inner, "R"), rect(6, 8, 8, 2, "w")]
    }
  },
  seedling: {
    label: "Seedling",
    usedFor: "First deposit, a new portfolio",
    palette: MEADOW,
    tones: { T: 0.7, D: 0.9, L: 0.25, G: 0.45 },
    draw: (t) => {
      const at = turn(Math.sin(t * 1.3) * 0.08, 10, 12)
      return [
        line([[10, 12.5], [10, 6.5]], 1.4, "G", { at }),
        ell(7, 8.2, 3, 1.5, "L", { rot: 0.5, at }),
        ell(13, 6.4, 3.2, 1.6, "G", { rot: -0.5, at }),
        poly([[5, 13.5], [15, 13.5], [14, 18.5], [6, 18.5]], "T"),
        rect(4, 12, 12, 2, "T"),
        ell(10, 12.2, 5, 0.75, "D")
      ]
    }
  },
  magnifier: {
    label: "Magnifier",
    usedFor: "Stock picker agent, research, no search results",
    palette: ["#c9d3ff", "#3c8aff", "#2a5bff", "#0a0b0d"],
    tones: { S: 0.12, D: 0.85 },
    draw: () => [
      line([[12.4, 12.4], [17, 17]], 2.8, "D"),
      disc(8.5, 8.5, 4.5, "S"),
      line([[5.3, 10.6], [7.3, 8.6], [8.8, 9.8], [11.4, 7]], 1.1, "B", { clip: disc(8.5, 8.5, 4.5) }),
      ring(8.5, 8.5, 5.4, 1.9, "B")
    ]
  },
  globe: {
    label: "Globe",
    usedFor: "Trading 24/7, around the clock",
    palette: MEADOW,
    tones: { C: 0.58, G: 0.3 },
    draw: (t) => {
      const off = (t * 0.9) % 16, ball = disc(10, 10, 8)
      const land: Array<Shape> = []
      for (const dx of [off, off - 16]) {
        land.push(
          ell(6 + dx, 6.6, 3, 2.1, "G", { clip: ball }),
          ell(5 + dx, 10.4, 1.6, 2.6, "G", { clip: ball }),
          ell(12.8 + dx, 12.4, 2.8, 2.5, "G", { clip: ball }),
          ell(13.6 + dx, 5.4, 2, 1.3, "G", { clip: ball }),
          ell(9.6 + dx, 16.4, 2, 1, "G", { clip: ball })
        )
      }
      return [disc(10, 10, 8, "C"), ...land]
    }
  },
  sun: {
    label: "Sun",
    usedFor: "Market open",
    palette: ["#fff4c7", "#ffd12f", "#f5a300", "#b8a581"],
    tones: { Y: 0.5, O: 0.66 },
    draw: (t) => {
      const spin = t * 0.25, rays: Array<Shape> = []
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4 + spin
        rays.push(
          line(
            [[10 + Math.cos(a) * 6.5, 10 + Math.sin(a) * 6.5], [10 + Math.cos(a) * 7.9, 10 + Math.sin(a) * 7.9]],
            1.8,
            "O"
          )
        )
      }
      return [...rays, disc(10, 10, 4.8, "Y")]
    }
  },
  moon: {
    label: "Moon",
    usedFor: "Market closed, agents waiting",
    palette: ["#cd99fd", "#3c8aff", "#2a5bff", "#1a3bc2"],
    tones: { Y: 0.5, O: 0.7, C: 0.3 },
    draw: (t) => {
      const tw = 0.5 + 0.5 * Math.cos(t * 2)
      return [
        disc(9, 10.6, 7.2, "Y", { cut: [disc(13.4, 7, 5.8)] }),
        disc(5.6, 13, 1, "O"),
        disc(9, 15.6, 0.8, "O"),
        disc(4.6, 9.4, 0.7, "O"),
        rect(15, 5.5 - 1.5 * tw, 1, 3 * tw, "C"),
        rect(14, 5, 3, 1, "C"),
        rect(17, 10, 1, 1, "C"),
        rect(12, 2, 1, 1, "C")
      ]
    }
  },
  bell: {
    label: "Bell",
    usedFor: "Approvals waiting, notifications",
    palette: COIN,
    tones: { Y: 0.34, D: 0.85 },
    draw: (t) => {
      const at = turn(Math.sin(t * 3) * 0.14 * Math.max(0, Math.sin(t * 0.8)), 10, 2.6)
      return [
        disc(10, 16.6, 1.6, "D", { at: turn(at.a * 1.6, 10, 2.6) }),
        ring(10, 2.8, 1.2, 1, "D", { at }),
        disc(10, 7.8, 4.4, "Y", { at }),
        poly([[5.6, 8], [14.4, 8], [15, 13], [17, 15], [3, 15], [5, 13]], "Y", { at }),
        rect(2.5, 14.5, 15, 1.8, "Y", { r: 0.9, at })
      ]
    }
  },
  chat: {
    label: "Chat",
    usedFor: "The assistant, conversations, memory",
    palette: BLUE,
    tones: { S: 0.24, B: 0.82 },
    draw: (t) => {
      // In halftone the assistant's three dots take turns rising, as a typing indicator does.
      const rise = (k: number) => Math.max(0, Math.sin(t * 4 - k * 0.9)) * 0.6
      return [
        rect(7, 2.5, 11, 8, "S", { r: 2.2 }),
        poly([[14, 10], [16.8, 10], [17.2, 13]], "S"),
        rect(2, 6.5, 13, 9, "B", { r: 2.4 }),
        poly([[4, 15], [7.4, 15], [3, 18.6]], "B"),
        disc(5.6, 11 - rise(0), 1.05, "w"),
        disc(8.5, 11 - rise(1), 1.05, "w"),
        disc(11.4, 11 - rise(2), 1.05, "w")
      ]
    }
  },
  devices: {
    label: "Devices",
    usedFor: "Devices signed in, sessions",
    palette: BLUE,
    tones: { D: 0.7, M: 0.4, C: 0.5 },
    draw: () => [
      rect(1.6, 3.6, 13, 9.4, "D", { r: 1.1 }),
      rect(2.7, 4.7, 10.8, 7.2, "B", { r: 0.4 }),
      rect(4.2, 6.4, 5.6, 1, "W", { r: 0.5 }),
      rect(4.2, 8.6, 3.6, 1, "W", { r: 0.5 }),
      poly([[0.6, 13], [15.6, 13], [16.4, 14.8], [-0.2, 14.8]], "M"),
      rect(12.6, 7.2, 6.2, 11.2, "N", { r: 1.3 }),
      rect(13.5, 8.6, 4.4, 8.2, "C", { r: 0.6 }),
      rect(14.9, 7.75, 1.6, 0.5, "D", { r: 0.25 })
    ]
  },
  plane: {
    label: "Paper plane",
    usedFor: "Telegram, messages sent to you",
    palette: BLUE,
    tones: { N: 0.9, C: 0.5 },
    draw: () => [
      poly([[1.5, 9.2], [18.5, 2.4], [13.6, 17.2]], "B"),
      poly([[7.6, 11.2], [18.5, 2.4], [9.6, 16.6]], "N"),
      poly([[7.6, 11.2], [9.6, 16.6], [9.8, 12.6]], "C")
    ]
  },
  phone: {
    label: "Phone",
    usedFor: "Push notifications",
    palette: BLUE,
    tones: { W: 0.16, M: 0.4 },
    draw: () => [
      rect(5, 1.5, 10, 17, "N", { r: 2 }),
      rect(6.2, 3, 7.6, 14, "C", { r: 1 }),
      rect(3.6, 5.2, 12.8, 4, "W", { r: 1.3 }),
      disc(5.8, 7.2, 1, "B"),
      rect(7.6, 6.3, 6.4, 0.8, "M", { r: 0.4 }),
      rect(7.6, 7.7, 4.2, 0.7, "M", { r: 0.35 }),
      disc(15.2, 2.4, 1.6, "R")
    ]
  },
  bolt: {
    label: "Bolt",
    usedFor: "Automations, triggers",
    palette: COIN,
    tones: { Y: 0.34, O: 0.55 },
    draw: () => {
      const pts: ReadonlyArray<Point> = [[11.6, 1.4], [4, 11.2], [9.2, 11.2], [8, 18.6], [16, 8.4], [10.8, 8.4]]
      return [poly(pts, "Y"), poly(pts, "O", { clip: rect(10, 0, 10, 20) })]
    }
  },
  notebook: {
    label: "Notebook",
    usedFor: "An agent's journal, what happened and why",
    palette: BLUE,
    tones: { W: 0.16, Y: 0.4 },
    draw: () => [
      rect(4, 2, 12.5, 16, "B", { r: 1.2 }),
      rect(15, 3, 1.5, 14, "W", { r: 0.4 }),
      rect(4, 2, 2.4, 16, "N", { r: 0.8 }),
      rect(8.2, 6.2, 5.8, 1, "W", { r: 0.5 }),
      rect(8.2, 8.8, 4.2, 1, "W", { r: 0.5 }),
      rect(8.2, 11.4, 5, 1, "W", { r: 0.5 }),
      poly([[11.6, 2], [13.8, 2], [13.8, 6.4], [12.7, 5.4], [11.6, 6.4]], "Y")
    ]
  },
  chart: {
    label: "Chart",
    usedFor: "Results, profit over time",
    palette: MEADOW,
    tones: { C: 0.5, N: 0.9 },
    draw: () => [
      rect(2, 16.8, 16, 1.2, "D", { r: 0.6 }),
      rect(3.6, 11.2, 3, 5.6, "C", { r: 0.6 }),
      rect(8.5, 8.2, 3, 8.6, "B", { r: 0.6 }),
      rect(13.4, 4.6, 3, 12.2, "N", { r: 0.6 }),
      line([[4.2, 8.4], [9.6, 5.4], [15.2, 2.2]], 1.2, "G"),
      disc(15.2, 2.2, 1.1, "G")
    ]
  },
  wallet: {
    label: "Wallet",
    usedFor: "Your account, cash (USDC) balance, deposits",
    palette: ["#ffe27a", "#3c8aff", "#2a5bff", "#1a3bc2"],
    tones: { W: 0.16, Y: 0.3 },
    draw: () => [
      rect(7, 2, 10, 7, "W", { r: 0.8 }),
      rect(4, 3.5, 10, 7, "Y", { r: 0.8 }),
      rect(4, 5.5, 10, 1, "O"),
      rect(2, 7, 16, 11, "B", { r: 1.4 }),
      rect(12, 10, 6, 4.5, "N", { r: 1 }),
      disc(14.6, 12.25, 0.95, "Y")
    ]
  },
  certificate: {
    label: "Stock certificate",
    usedFor: "Stock details, what you own",
    palette: ["#d9cca9", "#b8a581", "#3c8aff", "#2a5bff"],
    tones: { W: 0.2, M: 0.45, C: 0.62, Y: 0.45, B: 0.85 },
    draw: () => [
      rect(2, 3, 16, 12, "W", { r: 0.4 }),
      rect(3, 4, 14, 10, "C", { cut: [rect(4, 5, 12, 8)] }),
      rect(6, 6, 8, 1, "B"),
      rect(5, 8, 10, 1, "M"),
      rect(5, 10, 6, 1, "M"),
      poly([[12.4, 15], [14, 15], [13.4, 18.8], [12.5, 18], [11.6, 18.6]], "B"),
      poly([[15, 15], [16.6, 15], [17.4, 18.6], [16.5, 18], [15.6, 18.8]], "B"),
      disc(14.5, 14, 2.6, "Y"),
      disc(14.5, 14, 1.1, "O")
    ]
  },
  "empty-inbox": {
    label: "Empty inbox",
    usedFor: "No activity yet, nothing waiting for approval",
    palette: ["#dee1e7", "#8a909c", "#3c8aff", "#2a5bff"],
    tones: { S: 0.22, C: 0.6 },
    draw: () => [
      poly([[4.5, 4], [15.5, 4], [18, 11], [18, 17.5], [2, 17.5], [2, 11]], "M"),
      poly([[5.5, 5], [14.5, 5], [16.5, 11], [3.5, 11]], "S"),
      poly([[2, 11], [7, 11], [8, 13], [12, 13], [13, 11], [18, 11], [18, 17.5], [2, 17.5]], "C")
    ]
  },
  "paper-plane": {
    label: "Paper plane",
    usedFor: "Withdrawal sent, request sent for approval",
    palette: BLUE,
    tones: { W: 0.4, S: 0.6, M: 0.8, C: 0.5 },
    draw: (t) => {
      const dy = Math.sin(t * 1.6) * 0.5
      const lift = (pts: ReadonlyArray<Point>) => mapPoints(pts, ([x, y]) => [x, y + dy])
      return [
        line([[1.6, 18], [3.2, 17]], 1, "C"),
        line([[4.6, 16.2], [6, 15.3]], 1, "C"),
        poly(lift([[8.6, 11.8], [18.4, 2.4], [10.8, 17]]), "S"),
        poly(lift([[8.6, 11.8], [9.4, 15.8], [11.4, 13.6]]), "M"),
        poly(lift([[1.8, 9.2], [18.4, 2.4], [8.6, 11.8]]), "W")
      ]
    }
  },
  ...LEDGER_OBJECTS
} as const satisfies Record<string, IllustrationObject>

export type IllustrationName = keyof typeof OBJECTS

/** Every object name, in the kit's order. */
export const ILLUSTRATION_NAMES = Object.keys(OBJECTS) as ReadonlyArray<IllustrationName>

export const illustration = (name: IllustrationName): IllustrationObject => OBJECTS[name]
