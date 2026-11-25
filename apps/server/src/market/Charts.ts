import { multiplierScale } from "@bluechip/chain/market/Multipliers"
import { type HistoryRange, PricePoint, type StockSymbol } from "@bluechip/domain/market/Market"
import * as Cache from "effect/Cache"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Alpaca, type BarTimeframe } from "./alpaca/Alpaca.ts"
import { MarketPrices, toTokenPrice } from "./MarketPrices.ts"

interface RangeBars {
  readonly timeframe: BarTimeframe
  /** How far back to ask; 1D asks for several days and keeps the latest session. */
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
        if (range !== "1D" || points.length === 0) return points

        const lastSession = newYorkDate(points.at(-1)!.at)
        return points.filter((point) => newYorkDate(point.at) === lastSession)
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
