import { Devnet } from "@bluechip/devnet/Devnet"
import { InsufficientCash, InsufficientShares, QuoteUnavailable, SignatureRejected } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("trades", (it) => {
  describe("POST /api/trades", () => {
    it.effect("InsufficientCash: a buy with no cash", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(api.trades.prepare({
          payload: {
            requestId: RequestId.make(randomUUID()),
            symbol: "NVDA",
            side: "buy",
            amount: { usdc: Usdc.make(BigInt(1_000_000)) }
          }
        }))

        assert.deepStrictEqual({ ...error }, { ...new InsufficientCash({ available: BigInt(0) }) })
      }))

    it.effect("QuoteUnavailable: a buy of $0.99, under the smallest", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(api.trades.prepare({
          payload: {
            requestId: RequestId.make(randomUUID()),
            symbol: "NVDA",
            side: "buy",
            amount: { usdc: Usdc.make(BigInt(990_000)) }
          }
        }))

        assert.deepStrictEqual({ ...error }, { ...new QuoteUnavailable({ symbol: "NVDA", reason: "belowMinimum" }) })
      }))

    it.effect("InsufficientShares: a sell with no shares", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(api.trades.prepare({
          payload: {
            requestId: RequestId.make(randomUUID()),
            symbol: "NVDA",
            side: "sell",
            amount: { shares: Shares.make(BigInt(1)) }
          }
        }))

        assert.deepStrictEqual({ ...error }, { ...new InsufficientShares({ symbol: "NVDA", available: BigInt(0) }) })
      }))
  })

  describe("POST /api/trades/:id/confirm", () => {
    it.effect("a passkey-signed buy deploys the account and fills at least the quoted minimum", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const prepared = yield* user.api.trades.prepare({
          payload: {
            requestId: RequestId.make(randomUUID()),
            symbol: "NVDA",
            side: "buy",
            amount: { usdc: Usdc.make(BigInt(100_000_000)) }
          }
        })

        const sent = yield* user.api.trades.confirm({
          params: { id: prepared.id },
          payload: { credential: user.authenticator.authenticate(prepared.options) }
        })
        const { trade } = yield* user.events.next("TradeUpdated", ({ trade }) => trade.id === sent.id)

        assert.deepStrictEqual([prepared.deploysAccount, sent.status], [true, "confirming"])
        assert.deepStrictEqual([trade.status, trade.usdc], ["filled", BigInt(100_000_000)])
        assert.isTrue(trade.shares >= prepared.quote.minimumOut)
      }))

    it.effect("403: the same signature confirmed twice", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const prepared = yield* user.api.trades.prepare({
          payload: {
            requestId: RequestId.make(randomUUID()),
            symbol: "NVDA",
            side: "buy",
            amount: { usdc: Usdc.make(BigInt(100_000_000)) }
          }
        })
        const confirm = user.api.trades.confirm({
          params: { id: prepared.id },
          payload: { credential: user.authenticator.authenticate(prepared.options) }
        })
        yield* confirm

        const error = yield* Effect.flip(confirm)

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "challenge" }) })
      }))

    it.effect("a sell turns shares into cash and shows in activity", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        yield* (yield* Devnet).mintShares(user.account, "NVDA", BigInt(100_000_000))

        const prepared = yield* user.api.trades.prepare({
          payload: {
            requestId: RequestId.make(randomUUID()),
            symbol: "NVDA",
            side: "sell",
            amount: { shares: Shares.make(BigInt(50_000_000)) }
          }
        })
        const sent = yield* user.api.trades.confirm({
          params: { id: prepared.id },
          payload: { credential: user.authenticator.authenticate(prepared.options) }
        })
        const { trade } = yield* user.events.next("TradeUpdated", ({ trade }) => trade.id === sent.id)
        const portfolio = yield* user.api.portfolio.portfolio()
        const activity = yield* user.api.activity.list({ query: { kind: "trades" } })

        assert.strictEqual(trade.status, "filled")
        assert.strictEqual(portfolio.cash, BigInt(1_000_000_000) + trade.usdc)
        assert.deepStrictEqual(
          activity.items.map((item) => [item._tag, item._tag === "Trade" ? item.trade.side : null]),
          [["Trade", "sell"]]
        )
      }))
  })
})
