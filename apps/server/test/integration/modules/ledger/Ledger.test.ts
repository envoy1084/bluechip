import { RequestId } from "@bluechip/domain/Ids"
import { type Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { Ledger } from "../../../../src/modules/ledger/Ledger.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("Ledger", (it) => {
  describe("recordFill", () => {
    it.effect("a filled buy opens one lot holding what it cost", () =>
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

        const lots = yield* (yield* Ledger).openLots(user.id, "NVDA")

        assert.deepStrictEqual(
          lots.map((
            lot
          ) => [lot.symbol, lot.agentId, lot.shares, lot.cost, lot.remaining, lot.remainingCost, lot.flagged]),
          [["NVDA", null, trade.shares, BigInt(100_000_000), trade.shares, BigInt(100_000_000), false]]
        )
      }))

    it.effect("a filled sale of every share bought closes the lot", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const trade = Effect.fnUntraced(function*(side: "buy" | "sell", amount: { usdc: Usdc } | { shares: Shares }) {
          const prepared = yield* user.api.trades.prepare({
            payload: { requestId: RequestId.make(randomUUID()), symbol: "AAPL", side, amount }
          })
          const sent = yield* user.api.trades.confirm({
            params: { id: prepared.id },
            payload: { credential: user.authenticator.authenticate(prepared.options) }
          })
          return (yield* user.events.next("TradeUpdated", ({ trade }) => trade.id === sent.id)).trade
        })
        const bought = yield* trade("buy", { usdc: Usdc.make(BigInt(100_000_000)) })

        yield* trade("sell", { shares: bought.shares })
        const lots = yield* (yield* Ledger).openLots(user.id, "AAPL")

        assert.deepStrictEqual(lots, [])
      }))
  })
})
