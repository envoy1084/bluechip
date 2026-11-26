import { Devnet } from "@bluechip/devnet/Devnet"
import { QuoteUnavailable } from "@bluechip/domain/Errors"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { TestUsers } from "../../utils/TestUsers.ts"

// Market prices come from Alpaca's test layer: every stock at $100 a share, previous close $98.
// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("market API", (it) => {
  describe("GET /api/market/status", () => {
    it.effect("200: the market's session, without a session", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const status = yield* api.market.status()

        assert.include(["regular", "preMarket", "afterHours", "overnight", "paused"], status.session)
      }))
  })

  describe("GET /api/market/stocks", () => {
    it.effect("200: all 13 stocks, priced by the market, with Chainlink's reference", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser
        yield* (yield* Devnet).setPrice("MSFT", BigInt(10_050_000_000))

        const stocks = yield* api.market.stocks()

        const msft = stocks.find((stock) => stock.symbol === "MSFT")
        assert.strictEqual(stocks.length, 13)
        assert.deepStrictEqual(
          {
            tradable: msft?.tradable,
            price: msft?.price?.price,
            change: msft?.change24h,
            reference: msft?.reference?.price
          },
          { tradable: true, price: BigInt(10_000_000_000), change: 204, reference: BigInt(10_050_000_000) }
        )
      }))
  })

  describe("POST /api/market/quotes", () => {
    it.effect("200: a $100 buy of NVDA, within a few basis points of Chainlink's price", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const quote = yield* api.market.quote({
          payload: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(BigInt(100_000_000)) } }
        })

        assert.isTrue(quote.shares > BigInt(0))
        // The devnet's pools start at the feed's price, so the gap is the pool's fee and spread.
        assert.isAtMost(Math.abs(quote.gapBps), 20)
      }))

    it.effect("200: a $1 buy, the smallest", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const quote = yield* api.market.quote({
          payload: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(BigInt(1_000_000)) } }
        })

        assert.deepStrictEqual([quote.side, quote.usdc], ["buy", BigInt(1_000_000)])
      }))

    it.effect("422 QuoteUnavailable: a buy of $0.99, under the smallest", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const error = yield* Effect.flip(api.market.quote({
          payload: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(BigInt(990_000)) } }
        }))

        assert.deepStrictEqual({ ...error }, { ...new QuoteUnavailable({ symbol: "NVDA", reason: "belowMinimum" }) })
      }))
  })

  describe("GET /api/market/stocks/:symbol/history", () => {
    it.effect("200: a week of prices from the market", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const history = yield* api.market.history({ params: { symbol: "MSFT" }, query: { range: "1W" } })

        assert.deepStrictEqual(history.map((point) => point.price), [BigInt(9_800_000_000), BigInt(10_000_000_000)])
      }))
  })
})
