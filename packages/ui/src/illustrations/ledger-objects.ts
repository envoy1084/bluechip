/* The illustration objects for what an agent moves, spends and counts: coins changing hands, a receipt, a target, an
   hourglass and a tally; and for what starts an automation: a price move, a price level, the portfolio's mix and the
   news; and the emergency stop that acts on every agent at once. Drawn like the rest of `objects.ts`, which gathers them into the set. */
import type { Palette } from "../motion/halftone/engine.ts"
import { disc, ell, line, type Point, poly, rect, ring } from "./shapes.ts"

const BLUE: Palette = ["#c9d3ff", "#3c8aff", "#2a5bff", "#1a3bc2"]
const COIN: Palette = ["#ffe27a", "#ffd12f", "#3c8aff", "#2a5bff"]

const GLASS: ReadonlyArray<Point> = [
  [5.5, 3.5],
  [14.5, 3.5],
  [14.5, 5.2],
  [11, 10],
  [14.5, 14.8],
  [14.5, 16.5],
  [5.5, 16.5],
  [5.5, 14.8],
  [9, 10],
  [5.5, 5.2]
]

export const LEDGER_OBJECTS = {
  coins: {
    label: "Coins",
    usedFor: "Money an agent moved, bought and sold",
    palette: COIN,
    tones: { Y: 0.34, O: 0.55, C: 0.6, N: 0.9 },
    draw: (t: number) => {
      // In halftone the two coins bob against each other, trading places.
      const dy = Math.sin(t * 1.6) * 0.4
      return [
        disc(13.2, 7.4 + dy, 5.2, "N"),
        disc(12.6, 6.8 + dy, 5.2, "C"),
        ring(12.6, 6.8 + dy, 3.3, 1, "B"),
        disc(8, 13.2 - dy, 5.4, "O"),
        disc(7.4, 12.6 - dy, 5.4, "Y"),
        ring(7.4, 12.6 - dy, 3.4, 1, "O"),
        rect(6.9, 10.4 - dy, 1, 4.4, "O")
      ]
    }
  },
  receipt: {
    label: "Receipt",
    usedFor: "What trades cost: pool fees and slippage",
    palette: ["#dee1e7", "#8a909c", "#3c8aff", "#2a5bff"],
    tones: { W: 0.16, M: 0.45, B: 0.8 },
    draw: () => [
      poly(
        [
          [4, 2],
          [16, 2],
          [16, 18],
          [14.5, 16.8],
          [13, 18],
          [11.5, 16.8],
          [10, 18],
          [8.5, 16.8],
          [7, 18],
          [5.5, 16.8],
          [4, 18]
        ],
        "W"
      ),
      rect(6.5, 4.5, 7, 1, "M", { r: 0.5 }),
      rect(6.5, 7, 4, 1, "M", { r: 0.5 }),
      rect(12, 7, 1.5, 1, "M", { r: 0.5 }),
      rect(6.5, 9.5, 3, 1, "M", { r: 0.5 }),
      rect(12, 9.5, 1.5, 1, "M", { r: 0.5 }),
      rect(6.5, 12.5, 7, 2, "B", { r: 0.6 })
    ]
  },
  target: {
    label: "Target",
    usedFor: "A rebalancer's drift from its target mix",
    palette: ["#ffe27a", "#3c8aff", "#2a5bff", "#1a3bc2"],
    tones: { W: 0.16, Y: 0.36, D: 0.85 },
    draw: (t: number) => {
      // The dart lands a little off center, as a mix drifts; in halftone it quivers.
      const q = Math.sin(t * 9) * 0.25 * Math.max(0, Math.sin(t * 0.9))
      const tip: Point = [11.2, 8.8]
      return [
        disc(10.6, 10.6, 8, "N"),
        disc(10, 10, 8, "B"),
        disc(10, 10, 6, "W"),
        disc(10, 10, 4, "B"),
        disc(10, 10, 2, "Y"),
        line([tip, [16.4 + q, 3.6 - q]], 1.1, "D"),
        poly([[15.6 + q, 2.2 - q], [18.6 + q, 1.4 - q], [17.8 + q, 4.4 - q]], "R")
      ]
    }
  },
  hourglass: {
    label: "Hourglass",
    usedFor: "Today's limits and when they start again",
    palette: ["#fff4c7", "#ffd12f", "#b8a581", "#32353d"],
    tones: { S: 0.12, Y: 0.4, T: 0.7 },
    draw: (t: number) => {
      // The sand runs down in halftone and turns over; the still frame is a third of the way through.
      const k = (t * 0.12 + 0.34) % 1
      const top = 5.6 + k * 4.4, pile = 1.2 + k * 4
      return [
        poly(GLASS, "S"),
        poly(GLASS, "Y", { clip: rect(0, top, 20, 10 - top) }),
        poly(GLASS, "Y", { clip: rect(0, 16.5 - pile, 20, pile) }),
        line([[10, 9.6], [10, 16]], 1.1, "Y"),
        rect(4, 3, 1.2, 14, "T"),
        rect(14.8, 3, 1.2, 14, "T"),
        rect(3, 1.5, 14, 2, "T", { r: 0.6 }),
        rect(3, 16.5, 14, 2, "T", { r: 0.6 })
      ]
    }
  },
  tally: {
    label: "Tally",
    usedFor: "Trades counted against a daily limit",
    palette: BLUE,
    tones: { W: 0.16, D: 0.8, B: 0.7 },
    draw: () => [
      rect(2.6, 3.6, 15.4, 13.4, "M", { r: 1.2 }),
      rect(2, 3, 15.4, 13.4, "W", { r: 1.2 }),
      ...[5.5, 8.3, 11.1, 13.9].map((x) => line([[x, 6], [x, 13.4]], 1.3, "D")),
      line([[4, 12.4], [15.6, 7]], 1.5, "B")
    ]
  },
  "price-move": {
    label: "Price move",
    usedFor: "Automations that run when a stock rises or falls from its high or its close",
    palette: ["#fea8cd", "#fc401f", "#2a5bff", "#1a3bc2"],
    tones: { W: 0.16, R: 0.7, S: 0.34 },
    draw: (t: number) => {
      // In halftone the fall keeps slipping a little further below its high.
      const k = Math.max(0, Math.sin(t * 1.3)) * 0.6
      return [
        rect(2.6, 3.6, 15.4, 13.4, "M", { r: 1.2 }),
        rect(2, 3, 15.4, 13.4, "W", { r: 1.2 }),
        ...[3.6, 6.4, 9.2, 12, 14.8].map((x) => rect(x, 5, 1.6, 1, "S")),
        line([[4, 7], [6.8, 9.6], [9, 8.2], [12, 12.4 + k], [13.6, 13.2 + k]], 1.4, "R"),
        poly([[16.4, 15 + k], [12, 14.6 + k], [15.2, 10.8 + k]], "R")
      ]
    }
  },
  "price-level": {
    label: "Price level",
    usedFor: "Automations that run when a stock crosses a price you pick",
    palette: ["#ffe27a", "#3c8aff", "#2a5bff", "#1a3bc2"],
    tones: { W: 0.16, Y: 0.4, C: 0.5 },
    draw: (t: number) => {
      // The crossing point pulses in halftone.
      const r = 1.5 + Math.abs(Math.sin(t * 2)) * 0.4
      return [
        rect(2.6, 3.6, 15.4, 13.4, "M", { r: 1.2 }),
        rect(2, 3, 15.4, 13.4, "W", { r: 1.2 }),
        rect(3.4, 8.9, 12.6, 1.2, "C"),
        line([[4, 14.4], [7.2, 11.6], [9.6, 13], [12.6, 6.8], [15.4, 5.2]], 1.4, "B"),
        disc(11.5, 9.4, r, "Y")
      ]
    }
  },
  pie: {
    label: "Pie chart",
    usedFor: "Automations that run when cash or a holding reaches a share of your portfolio",
    palette: ["#ffe27a", "#ffd12f", "#3c8aff", "#2a5bff"],
    tones: { Y: 0.34, C: 0.55, N: 0.9 },
    draw: (t: number) => {
      // The slice eases out of the pie and back in halftone.
      const d = 1.3 + Math.sin(t * 1.5) * 0.4
      const cx = 9, cy = 11, r = 7
      const slice = rect(cx, cy - r - 1, r + 1, r + 1)
      return [
        disc(cx + 0.6, cy + 0.6, r, "N", { cut: [slice] }),
        disc(cx, cy, r, "B", { cut: [slice] }),
        disc(cx, cy, r, "C", { clip: rect(cx - r - 1, cy, r + 1, r + 1) }),
        disc(cx + d, cy - d, r, "Y", { clip: rect(cx + d, cy - d - r - 1, r + 1, r + 1) })
      ]
    }
  },
  newspaper: {
    label: "Newspaper",
    usedFor: "Automations that run on news about a stock or a topic",
    palette: BLUE,
    tones: { W: 0.16, S: 0.28, C: 0.55, D: 0.85 },
    draw: () => [
      rect(3.4, 4.4, 14.4, 13, "M", { r: 1 }),
      rect(2.6, 3.6, 14.4, 13, "W", { r: 1 }),
      rect(15.6, 5.6, 2.6, 11, "S", { r: 1 }),
      rect(4.4, 5.4, 9.6, 2, "B", { r: 0.5 }),
      rect(4.4, 8.6, 4.4, 4.4, "C", { r: 0.4 }),
      rect(10, 8.6, 4.2, 1, "D", { r: 0.5 }),
      rect(10, 10.6, 4.2, 1, "M", { r: 0.5 }),
      rect(10, 12.6, 3, 1, "M", { r: 0.5 }),
      rect(4.4, 14.4, 9.8, 1, "M", { r: 0.5 })
    ]
  },
  "emergency-stop": {
    label: "Emergency stop",
    usedFor: "The danger zone: pausing or removing every agent at once",
    palette: ["#ffe27a", "#fc401f", "#c22a0c", "#0a0b0d"],
    tones: { Y: 0.34, R: 0.62, K: 0.9 },
    draw: (t: number) => {
      // In halftone the button is pressed now and then, sinking into its collar and springing back.
      const press = Math.max(0, Math.sin(t * 1.2)) ** 6 * 1.1
      const plate = rect(2.6, 12.6, 14.8, 5.4)
      return [
        rect(2.6, 12.6, 16, 6.6, "D", { r: 1.2 }),
        rect(2, 12, 16, 6.6, "Y", { r: 1.2 }),
        ...[0, 4, 8, 12, 16].map((x) => line([[x, 18.6], [x + 5, 12]], 1.6, "K", { clip: plate })),
        rect(6.5, 9 + press, 7, 3.4 - press, "M"),
        disc(10, 9.4 + press, 6.4, "R", { clip: rect(0, 0, 20, 9.4 + press) }),
        rect(3.6, 8.6 + press, 12.8, 1.8, "R", { r: 0.9 }),
        ell(7.6, 5.8 + press, 1.7, 0.9, "P")
      ]
    }
  }
} as const
