import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { call } from "../support/api.ts"

// Market prices come from Alpaca's test layer: every stock at $100 a share, previous close $98.
layer(DevnetTest.layer)("market API", (it) => {
  describe("GET /api/market/status", () => {
    it.effect("200: the market's session, without a session", () =>
      Effect.gen(function*() {
        const status = yield* call("GET", "/api/market/status")

        assert.strictEqual(status.status, 200)
        assert.include(["regular", "preMarket", "afterHours", "overnight", "paused"], status.json.session)
      }))
  })

  describe("GET /api/market/stocks", () => {
    it.effect("200: all 13 stocks, priced by the market, with Chainlink's reference", () =>
      Effect.gen(function*() {
        yield* (yield* Devnet).setPrice("MSFT", BigInt(10_050_000_000))

        const stocks = yield* call("GET", "/api/market/stocks")

        assert.strictEqual(stocks.json.length, 13)
        const msft = stocks.json.find((stock: { symbol: string }) => stock.symbol === "MSFT")
        assert.deepStrictEqual(
          { tradable: msft.tradable, price: msft.price.price, change: msft.change24h, reference: msft.reference.price },
          { tradable: true, price: "10000000000", change: 204, reference: "10050000000" }
        )
      }))
  })

  describe("POST /api/market/quotes", () => {
    it.effect("200: a $100 buy of NVDA, within a few basis points of Chainlink's price", () =>
      Effect.gen(function*() {
        const quote = yield* call("POST", "/api/market/quotes", {
          body: { symbol: "NVDA", side: "buy", amount: { usdc: "100000000" } }
        })

        assert.strictEqual(quote.status, 200)
        assert.match(quote.json.shares, /^[1-9][0-9]*$/)
        // The devnet's pools start at the feed's price, so the gap is the pool's fee and spread.
        assert.isAtMost(Math.abs(quote.json.gapBps), 20)
      }))
  })

  describe("GET /api/market/stocks/:symbol/history", () => {
    it.effect("200: a week of prices from the market", () =>
      Effect.gen(function*() {
        const history = yield* call("GET", "/api/market/stocks/MSFT/history?range=1W")

        assert.deepStrictEqual(history.json.map((point: { price: string }) => point.price), [
          "9800000000",
          "10000000000"
        ])
      }))
  })
})
