import { Predicate } from "effect"

/** How much of a dashboard's width a tile takes: a counter in the top row, half a row, or the whole row. */
export type TileSize = "counter" | "half" | "full"

/** Where a tile sits on PostHog's grid: 12 columns wide (`sm`), one on a phone (`xs`). */
export interface TileLayout {
  readonly sm: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly xs: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
}

const COLUMNS = 12
const HEIGHT: Readonly<Record<TileSize, number>> = { counter: 5, half: 6, full: 6 }
// Funnels, retention tables and paths need the room; a big number reads as a counter.
const FULL = new Set(["FunnelsQuery", "RetentionQuery", "PathsQuery"])

/** A saved insight's tile size, from its query. */
export const sizeOf = (query: unknown): TileSize => {
  const source = Predicate.isObject(query) && Predicate.isObject(query.source) ? query.source : {}
  if (FULL.has(String(source.kind))) return "full"
  const display = Predicate.isObject(source.trendsFilter) ? source.trendsFilter.display : undefined
  return display === "BoldNumber" ? "counter" : "half"
}

/**
 * Each tile's place, in order: counters share the first rows (up to four a row, filling it), wide tiles take a row of
 * their own, and the rest go two by two. A half tile left alone on its row takes the row.
 */
export const tileLayouts = (sizes: ReadonlyArray<TileSize>): ReadonlyArray<TileLayout> => {
  const rows: Array<Array<number>> = []
  sizes.forEach((size, index) => {
    const last = rows.at(-1)
    const lastSize = last === undefined ? undefined : sizes[last[0]!]
    const fits = last !== undefined && lastSize === size &&
      (size === "counter" ? last.length < 4 : size === "half" && last.length < 2)
    if (fits) last.push(index)
    else rows.push([index])
  })

  const layouts: Array<TileLayout> = []
  let y = 0
  let xsY = 0
  for (const row of rows) {
    const h = HEIGHT[sizes[row[0]!]!]
    const w = COLUMNS / row.length
    row.forEach((_, position) => {
      layouts.push({ sm: { x: position * w, y, w, h }, xs: { x: 0, y: xsY, w: 1, h } })
      xsY += h
    })
    y += h
  }
  return layouts
}
