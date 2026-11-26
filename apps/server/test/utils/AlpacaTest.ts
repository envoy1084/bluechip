import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { Alpaca } from "../../src/modules/market/alpaca/Alpaca.ts"

/** Every stock at $100 a share (previous close $98), two daily bars, no news, and a trade stream that stays quiet. */
export const AlpacaTest = Layer.succeed(Alpaca, {
  snapshots: (symbols) =>
    Effect.succeed(
      new Map(symbols.map((symbol) => [symbol, { price: 100, tradedAt: "2026-11-24T20:59:59Z", previousClose: 98 }]))
    ),
  bars: () =>
    Effect.succeed([
      { at: "2026-11-23T21:00:00Z", close: 98 },
      { at: "2026-11-24T21:00:00Z", close: 100 }
    ]),
  news: () => Effect.succeed([]),
  newsStream: () => Stream.never,
  trades: () => Stream.never
})
