// Times after a chain's clock for tests that move it: whatever today is, the next weekend or market day comes.
import * as DateTime from "effect/DateTime"
import { marketStatus } from "../../src/modules/market/Calendar.ts"

/** 17:00 UTC on the first Saturday after `timestamp` (a block's, in seconds): prices are paused all day. */
export const nextSaturday = (timestamp: bigint): Date => {
  const after = DateTime.makeUnsafe(Number(timestamp) * 1000)
  const days = ((6 - DateTime.getPartUtc(after, "weekDay")) % 7) || 7
  return DateTime.toDate(DateTime.add(DateTime.startOf(after, "day"), { days, hours: 17 }))
}

/**
 * 15:00 UTC (10 or 11 am in New York) on the first day after `timestamp` (a block's, in seconds) with a regular
 * session then.
 */
export const nextMarketDay = (timestamp: bigint): Date => {
  let at = DateTime.add(DateTime.startOf(DateTime.makeUnsafe(Number(timestamp) * 1000), "day"), { days: 1, hours: 15 })
  while (marketStatus(at).session !== "regular") at = DateTime.add(at, { days: 1 })
  return DateTime.toDate(at)
}
