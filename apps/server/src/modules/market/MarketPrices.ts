import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { stocks } from "@bluechip/chain/Contracts"
import { multiplierScale, readMultipliers } from "@bluechip/chain/market/Multipliers"
import { LiveEvent } from "@bluechip/domain/Events"
import { MarketPrice, type StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { Alpaca, type AlpacaError } from "./alpaca/Alpaca.ts"

const symbols = stocks.map((stock) => stock.symbol)

/** A share's price in dollars as a token's price (USD × 1e8): the share price times the token's multiplier. */
export const toTokenPrice = (dollars: number, multiplier: bigint): Price =>
  Price.make((BigInt(Math.round(dollars * 1e8)) * multiplier) / multiplierScale)

/**
 * Every stock's market price per token, live: Alpaca's snapshots at startup and every 5 minutes (they also carry the
 * previous close), its trade stream in between, converted with each token's multiplier (read from the chain daily).
 * Changes go out as `PriceTick` live events, at most once a second.
 */
export class MarketPrices extends Context.Service<MarketPrices, {
  readonly prices: Effect.Effect<ReadonlyMap<StockSymbol, MarketPrice>>
  readonly multipliers: Effect.Effect<ReadonlyMap<string, bigint>>
  /** Every stock's price now, read afresh: its multiplier from the chain and one Alpaca snapshot request. */
  readonly read: Effect.Effect<ReadonlyMap<StockSymbol, MarketPrice>, ChainError | AlpacaError>
}>()("@bluechip/server/MarketPrices") {
  static readonly layer = Layer.effect(
    MarketPrices,
    Effect.gen(function*() {
      const alpaca = yield* Alpaca
      const chain = yield* ChainClient
      const live = yield* LiveEvents

      const multipliers = yield* Ref.make<ReadonlyMap<string, bigint>>(new Map())
      const prices = yield* Ref.make<ReadonlyMap<StockSymbol, MarketPrice>>(new Map())
      const changed = yield* Ref.make<ReadonlySet<StockSymbol>>(new Set())

      // Every stock's latest market price from one Alpaca snapshot request, converted with the given multipliers.
      const readWith = Effect.fnUntraced(function*(known: ReadonlyMap<string, bigint>) {
        const snapshots = yield* alpaca.snapshots(symbols)
        return new Map([...snapshots].map(([symbol, snapshot]) => {
          const multiplier = known.get(symbol) ?? multiplierScale
          return [
            symbol as StockSymbol,
            new MarketPrice({
              symbol: symbol as StockSymbol,
              price: toTokenPrice(snapshot.price, multiplier),
              tradedAt: DateTime.makeUnsafe(snapshot.tradedAt),
              previousClose: snapshot.previousClose === null ? null : toTokenPrice(snapshot.previousClose, multiplier)
            })
          ]
        }))
      })

      const multiplierOf = (symbol: string) =>
        Effect.map(Ref.get(multipliers), (known) => known.get(symbol) ?? multiplierScale)

      const update = Effect.fnUntraced(function*(next: MarketPrice) {
        yield* Ref.update(prices, (current) => new Map(current).set(next.symbol, next))
        yield* Ref.update(changed, (current) => new Set(current).add(next.symbol))
      })

      const refreshMultipliers = readMultipliers(chain).pipe(
        Effect.flatMap((read) => Ref.set(multipliers, read)),
        Effect.catch((error) => Effect.logWarning("Could not read token multipliers", error))
      )

      const refreshSnapshots = Effect.gen(function*() {
        const latest = yield* readWith(yield* Ref.get(multipliers))
        for (const price of latest.values()) yield* update(price)
      }).pipe(
        Effect.catch((error) => Effect.logWarning("Could not read Alpaca snapshots", error))
      )

      const followTrades = alpaca.trades(symbols).pipe(
        Stream.runForEach((trade) =>
          Effect.gen(function*() {
            const current = (yield* Ref.get(prices)).get(trade.symbol as StockSymbol)
            const tradedAt = DateTime.makeUnsafe(trade.tradedAt)
            if (current !== undefined && DateTime.isLessThan(tradedAt, current.tradedAt)) return

            yield* update(
              new MarketPrice({
                symbol: trade.symbol as StockSymbol,
                price: toTokenPrice(trade.price, yield* multiplierOf(trade.symbol)),
                tradedAt,
                previousClose: current?.previousClose ?? null
              })
            )
          })
        ),
        Effect.tapError((error) => Effect.logWarning("Alpaca trade stream dropped", error)),
        Effect.retry(Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("1 minute")]))
      )

      const announce = Effect.gen(function*() {
        const symbolsChanged = yield* Ref.getAndSet(changed, new Set())
        if (symbolsChanged.size === 0) return

        const current = yield* Ref.get(prices)
        const moved = [...symbolsChanged].flatMap((symbol) => current.get(symbol) ?? [])
        yield* live.publish(LiveEvent.cases.PriceTick.make({ prices: moved }))
      })

      yield* refreshMultipliers
      yield* refreshSnapshots
      yield* Ref.set(changed, new Set())

      yield* Effect.forkScoped(refreshMultipliers.pipe(Effect.repeat(Schedule.spaced("24 hours"))))
      yield* Effect.forkScoped(refreshSnapshots.pipe(Effect.repeat(Schedule.spaced("5 minutes"))))
      yield* Effect.forkScoped(followTrades)
      yield* Effect.forkScoped(announce.pipe(Effect.repeat(Schedule.spaced("1 second"))))

      return MarketPrices.of({
        prices: Ref.get(prices),
        multipliers: Ref.get(multipliers),
        read: readMultipliers(chain).pipe(Effect.flatMap(readWith), Effect.withSpan("MarketPrices.read"))
      })
    })
  )
}
