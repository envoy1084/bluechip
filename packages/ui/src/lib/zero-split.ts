import type { ChartLinearGradient } from "@tanstack/charts"

/** The paints of a signed series: one for zero and up, one for below zero. */
export interface SignedColors {
  readonly above: string
  readonly below: string
}

/** A signed series' paints: its line and its fill down to zero, each split exactly at zero. */
export interface SignedPaint {
  readonly line: string
  readonly area: string
  /** The gradients `line` and `area` point to, for the chart's `gradients`. */
  readonly gradients: ReadonlyArray<ChartLinearGradient>
}

/** The fill's opacity away from zero and at it: strongest at the extremes, fading into the baseline. */
const FILL_EDGE = 0.16
const FILL_ZERO = 0.02

/**
 * Where zero falls down a shape spanning `low` to `high`: 0 at its top, 1 at its bottom, clamped for a shape that
 * stays on one side. `null` for a flat shape, since a gradient sized to its box paints nothing on a box with no height.
 */
export const zeroOffset = (low: number, high: number): number | null =>
  high === low ? null : Math.min(1, Math.max(0, high / (high - low)))

/** The color of one value: `below` under zero, `above` otherwise. */
export const signedColor = (value: number, colors: SignedColors): string => value < 0 ? colors.below : colors.above

/**
 * The paints for a series that can go below zero, as SVG gradients from top to bottom of each shape's box (how
 * `@tanstack/charts` sizes them) with a hard stop at zero. The line spans the values; the area spans them and zero
 * (`y1: 0`). Entrance and update motion move every point by the same affine map, so the split stays on zero.
 */
export const signedPaint = (id: string, values: ReadonlyArray<number>, colors: SignedColors): SignedPaint => {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const lineZero = zeroOffset(low, high)
  const areaZero = zeroOffset(Math.min(low, 0), Math.max(high, 0))
  const gradients: Array<ChartLinearGradient> = []

  if (lineZero !== null) {
    gradients.push({
      id: `${id}-line`,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      stops: [
        ...(lineZero > 0 ? [{ offset: 0, color: colors.above }, { offset: lineZero, color: colors.above }] : []),
        ...(lineZero < 1 ? [{ offset: lineZero, color: colors.below }, { offset: 1, color: colors.below }] : [])
      ]
    })
  }

  if (areaZero !== null) {
    gradients.push({
      id: `${id}-area`,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      stops: [
        ...(areaZero > 0 ?
          [
            { offset: 0, color: colors.above, opacity: FILL_EDGE },
            { offset: areaZero, color: colors.above, opacity: FILL_ZERO }
          ] :
          []),
        ...(areaZero < 1 ?
          [
            { offset: areaZero, color: colors.below, opacity: FILL_ZERO },
            { offset: 1, color: colors.below, opacity: FILL_EDGE }
          ] :
          [])
      ]
    })
  }

  return {
    line: lineZero === null ? signedColor(low, colors) : `url(#${id}-line)`,
    area: areaZero === null ? "none" : `url(#${id}-area)`,
    gradients
  }
}
