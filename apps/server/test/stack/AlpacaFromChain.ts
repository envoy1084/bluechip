// Market data for the browser suite: every stock's share price is what its devnet feed says (read once at startup,
// through the token's multiplier), so the market and Chainlink agree on every page. The previous close is 2% lower,
// with two daily bars, and the trade stream stays quiet, as in `AlpacaTest`.
import { ChainClient } from "@bluechip/chain/ChainClient"
import { multiplierScale, readMultipliers } from "@bluechip/chain/market/Multipliers"
import { readPrices } from "@bluechip/chain/market/Prices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { Alpaca } from "../../src/modules/market/alpaca/Alpaca.ts"

export const AlpacaFromChain = Layer.effect(
  Alpaca,
  Effect.gen(function*() {
    const chain = yield* ChainClient
    const { asOf, prices } = yield* Effect.orDie(readPrices(chain))
    const multipliers = yield* Effect.orDie(readMultipliers(chain))

    const shares = new Map(prices.map(({ price, stock }) => {
      const tokenPrice = Number(price) / 1e8
      const multiplier = multipliers.get(stock.symbol) ?? multiplierScale
      return [stock.symbol, Math.round(tokenPrice * Number(multiplierScale) / Number(multiplier) * 100) / 100]
    }))
    const tradedAt = asOf.toISOString()
    const yesterday = new Date(asOf.getTime() - 86_400_000).toISOString()

    return Alpaca.of({
      snapshots: (symbols) =>
        Effect.succeed(
          new Map(symbols.flatMap((symbol) => {
            const price = shares.get(symbol)
            return price === undefined ?
              [] :
              [[symbol, { price, tradedAt, previousClose: Math.round(price / 1.02 * 100) / 100 }]]
          }))
        ),
      bars: (symbol) => {
        const price = shares.get(symbol) ?? 100
        return Effect.succeed([
          { at: yesterday, close: Math.round(price / 1.02 * 100) / 100 },
          { at: tradedAt, close: price }
        ])
      },
      trades: () => Stream.never
    })
  })
)
