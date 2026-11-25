import { multiplierScale } from "@bluechip/chain/market/Multipliers"
import { type HistoryRange, PricePoint, type StockSymbol } from "@bluechip/domain/market/Market"
import * as Cache from "effect/Cache"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Alpaca, type BarTimeframe } from "./alpaca/Alpaca.ts"
import { marketStatus } from "./Calendar.ts"
import { MarketPrices, toTokenPrice } from "./MarketPrices.ts"

interface RangeBars {
  readonly timeframe: BarTimeframe
  /** How far back to ask; 1D asks for several days and keeps only the past day (see `pastDay`). */
  readonly days: number
  readonly cacheFor: Duration.Input
}

const RANGES: Readonly<Record<HistoryRange, RangeBars>> = {
  "1D": { timeframe: "5Min", days: 5, cacheFor: "1 minute" },
  "1W": { timeframe: "30Min", days: 7, cacheFor: "5 minutes" },
  "1M": { timeframe: "1Hour", days: 30, cacheFor: "1 hour" },
  "3M": { timeframe: "1Day", days: 90, cacheFor: "1 hour" },
  "ALL": { timeframe: "1Day", days: 3650, cacheFor: "1 hour" }
}

const NEW_YORK = DateTime.zoneMakeNamedUnsafe("America/New_York")
const newYorkDate = (at: DateTime.Utc) => DateTime.formatIsoDate(DateTime.setZone(at, NEW_YORK))

/**
 * The past day of a 5-minute series: from the start of the latest day that had a regular session, so before the
 * opening bell (or over a weekend) the chart still shows the last full trading day, followed by any extended hours.
 */
export const pastDay = (points: ReadonlyArray<PricePoint>): ReadonlyArray<PricePoint> => {
  const lastRegular = points.findLast((point) => marketStatus(point.at).session === "regular")
  if (lastRegular === undefined) return points

  const day = newYorkDate(lastRegular.at)
  return points.filter((point) => newYorkDate(point.at) >= day)
}

// A chart is a few hundred pixels wide: more points only cost bytes and rendering time.
const MAX_POINTS = 300

/**
 * At most 300 points that keep a chart's shape: the range is cut into equal slices of points, and each slice keeps
 * its lowest and highest price (in time order), so no peak or dip disappears. First and last points always stay.
 */
export const thin = (points: ReadonlyArray<PricePoint>): ReadonlyArray<PricePoint> => {
  if (points.length <= MAX_POINTS) return points

  const slices = MAX_POINTS / 2 - 1
  const size = (points.length - 2) / slices
  const kept: Array<PricePoint> = [points[0]!]

  for (let slice = 0; slice < slices; slice++) {
    const members = points.slice(1 + Math.floor(slice * size), 1 + Math.floor((slice + 1) * size))
    if (members.length === 0) continue

    const low = members.reduce((min, point) => (point.price < min.price ? point : min))
    const high = members.reduce((max, point) => (point.price > max.price ? point : max))
    kept.push(...(low === high ? [low] : members.indexOf(low) < members.indexOf(high) ? [low, high] : [high, low]))
  }

  kept.push(points.at(-1)!)
  return kept
}

/**
 * Price charts from Alpaca's bars, as token prices. Each stock and range is fetched once per cache window and shared
 * by every viewer, so requests to Alpaca don't grow with users.
 */
export class Charts extends Context.Service<Charts, {
  readonly history: (symbol: StockSymbol, range: HistoryRange) => Effect.Effect<ReadonlyArray<PricePoint>>
}>()("@bluechip/server/Charts") {
  static readonly layer = Layer.effect(
    Charts,
    Effect.gen(function*() {
      const alpaca = yield* Alpaca
      const market = yield* MarketPrices

      const load = Effect.fnUntraced(function*(symbol: StockSymbol, range: HistoryRange) {
        const { days, timeframe } = RANGES[range]
        const start = DateTime.toDateUtc(DateTime.subtract(yield* DateTime.now, { days }))
        const bars = yield* alpaca.bars(symbol, { timeframe, start })
        const multiplier = (yield* market.multipliers).get(symbol)

        const points = bars.map((bar) =>
          new PricePoint({
            at: DateTime.makeUnsafe(bar.at),
            price: toTokenPrice(bar.close, multiplier ?? multiplierScale)
          })
        )
        return thin(range === "1D" ? pastDay(points) : points)
      })

      // Keyed "NVDA 1D": a failed load is cached briefly too, so a down Alpaca isn't asked on every view.
      const cache = yield* Cache.makeWith(
        (key: `${StockSymbol} ${HistoryRange}`) => {
          const [symbol, range] = key.split(" ") as [StockSymbol, HistoryRange]
          return load(symbol, range).pipe(
            Effect.catch((error) =>
              Effect.logWarning(`Could not load the ${range} chart of ${symbol}`, error).pipe(
                Effect.as<ReadonlyArray<PricePoint>>([])
              )
            )
          )
        },
        { capacity: 128, timeToLive: (_, key) => RANGES[key.split(" ")[1] as HistoryRange].cacheFor }
      )

      return { history: (symbol, range) => Cache.get(cache, `${symbol} ${range}` as const) }
    })
  )
}
