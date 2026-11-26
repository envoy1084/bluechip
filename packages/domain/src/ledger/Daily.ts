/**
 * Profit and loss by day: each day's rows per stock and agent, gathered from the trades and closings of that day, and
 * the running totals a chart draws.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"

/**
 * The UTC day (`2026-11-27`) a moment falls on: the ledger's days are UTC days.
 *
 * @stability unstable
 * @category days
 * @since 0.0.0
 */
export const dayOf = (at: DateTime.DateTime): string => DateTime.formatIso(DateTime.toUtc(at)).slice(0, 10)

/**
 * One day's results for one stock and one agent (`null` for your own trades): profit or loss realised by sales, fees,
 * slippage and gas (wei) paid, and how many trades filled. Unrealised profit is measured apart, each hour.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface DailyRow {
  readonly day: string
  readonly symbol: string
  readonly agentId: string | null
  readonly realised: bigint
  readonly fees: bigint
  readonly slippage: bigint
  readonly gasWei: bigint
  readonly trades: number
}

const zero = BigInt(0)

/**
 * Each day's rows from what filled and what sales closed, one per (day, stock, agent) that had either, in the order
 * first seen. A trade's costs count on the day it filled; a closing's realised profit on the day of its sale, for the
 * agent that sold.
 *
 * **Example** (A buy and a sale on the same day)
 *
 * ```ts import.meta.vitest
 * import { dailyRows } from "@bluechip/domain/ledger/Daily"
 *
 * dailyRows(
 *   [
 *     { day: "2026-11-27", symbol: "NVDA", agentId: null, fee: 50n, slippage: 10n, gasWei: 7n },
 *     { day: "2026-11-27", symbol: "NVDA", agentId: null, fee: 40n, slippage: -5n, gasWei: 7n }
 *   ],
 *   [{ day: "2026-11-27", symbol: "NVDA", agentId: null, realised: 300n }]
 * )
 * // => [{ day: "2026-11-27", symbol: "NVDA", agentId: null, realised: 300n, fees: 90n, slippage: 5n, gasWei: 14n, trades: 2 }]
 * ```
 *
 * @stability unstable
 * @category days
 * @since 0.0.0
 */
export const dailyRows = (
  trades: ReadonlyArray<{
    readonly day: string
    readonly symbol: string
    readonly agentId: string | null
    readonly fee: bigint
    readonly slippage: bigint
    readonly gasWei: bigint
  }>,
  closings: ReadonlyArray<{
    readonly day: string
    readonly symbol: string
    readonly agentId: string | null
    readonly realised: bigint
  }>
): ReadonlyArray<DailyRow> => {
  const rows = new Map<string, DailyRow>()
  const rowOf = (day: string, symbol: string, agentId: string | null): DailyRow => {
    const key = `${day}|${symbol}|${agentId ?? ""}`
    const row = rows.get(key) ??
      { day, symbol, agentId, realised: zero, fees: zero, slippage: zero, gasWei: zero, trades: 0 }
    rows.set(key, row)
    return row
  }
  const update = (row: DailyRow, next: DailyRow) => rows.set(`${row.day}|${row.symbol}|${row.agentId ?? ""}`, next)

  for (const trade of trades) {
    const row = rowOf(trade.day, trade.symbol, trade.agentId)
    update(row, {
      ...row,
      fees: row.fees + trade.fee,
      slippage: row.slippage + trade.slippage,
      gasWei: row.gasWei + trade.gasWei,
      trades: row.trades + 1
    })
  }
  for (const closing of closings) {
    const row = rowOf(closing.day, closing.symbol, closing.agentId)
    update(row, { ...row, realised: row.realised + closing.realised })
  }

  return [...rows.values()]
}

/**
 * One day of a profit chart: profit realised so far (running total), unrealised profit at the day's last
 * measurement, and both together.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface SeriesPoint {
  readonly day: string
  readonly realised: bigint
  readonly unrealised: bigint
  readonly total: bigint
}

/**
 * The chart of `rows` (any stocks and agents, any order), one point per day that has a row, oldest first. A day with
 * no unrealised measurement (`null` on every row, from before measurements began or a day the server was down)
 * keeps the last one known, starting at zero.
 *
 * **Example** (Two days, the second not measured)
 *
 * ```ts import.meta.vitest
 * import { series } from "@bluechip/domain/ledger/Daily"
 *
 * series([
 *   { day: "2026-11-27", realised: 0n, unrealised: 40n },
 *   { day: "2026-11-26", realised: 100n, unrealised: null },
 *   { day: "2026-11-27", realised: 25n, unrealised: 10n },
 *   { day: "2026-11-28", realised: 5n, unrealised: null }
 * ]).map((point) => point.total)
 * // => [100n, 175n, 180n]
 * ```
 *
 * @stability unstable
 * @category days
 * @since 0.0.0
 */
export const series = (
  rows: ReadonlyArray<{ readonly day: string; readonly realised: bigint; readonly unrealised: bigint | null }>
): ReadonlyArray<SeriesPoint> => {
  const days = new Map<string, { realised: bigint; unrealised: bigint | null }>()
  for (const row of rows) {
    const day = days.get(row.day) ?? { realised: zero, unrealised: null }
    days.set(row.day, {
      realised: day.realised + row.realised,
      unrealised: row.unrealised === null ? day.unrealised : (day.unrealised ?? zero) + row.unrealised
    })
  }

  let realised = zero
  let unrealised = zero
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, totals]) => {
      realised += totals.realised
      unrealised = totals.unrealised ?? unrealised
      return { day, realised, unrealised, total: realised + unrealised }
    })
}
