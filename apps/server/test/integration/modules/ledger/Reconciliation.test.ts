import { DevChain } from "@bluechip/chain/DevChain"
import { Devnet } from "@bluechip/devnet/Devnet"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Ledger } from "../../../../src/modules/ledger/Ledger.ts"
import { Reconciliation } from "../../../../src/modules/ledger/Reconciliation.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("Reconciliation", (it) => {
  describe("check", () => {
    it.effect("USDC sent straight to a new account: a deposit, and its owner told", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        yield* (yield* DevChain).sendUsdc(user.account, BigInt(250_000_000))

        const result = yield* (yield* Reconciliation).check({ userId: user.id })
        const { notification } = yield* user.events.next("NotificationAdded")
        const { items } = yield* user.api.transfers.list({ query: {} })

        assert.deepStrictEqual(result, { checked: 1, skipped: 0 })
        assert.deepStrictEqual([notification.kind, notification.title], ["deposit", "$250.00 of USDC arrived"])
        assert.deepStrictEqual(
          items.map((transfer) => [transfer.kind, transfer.asset, transfer.amount, transfer.status, transfer.to]),
          [["deposit", "USDC", BigInt(250_000_000), "confirmed", user.account]]
        )
      }))

    it.effect("checked again with nothing new: the deposit is recorded once", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const reconciliation = yield* Reconciliation
        yield* (yield* DevChain).sendUsdc(user.account, BigInt(10_000_000))
        yield* reconciliation.check({ userId: user.id })

        yield* reconciliation.check({ userId: user.id })
        const { items } = yield* user.api.transfers.list({ query: {} })

        assert.deepStrictEqual(items.map((transfer) => transfer.amount), [BigInt(10_000_000)])
      }))

    it.effect("a stock sent from outside: a flagged lot at the market price, and an alert", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const reconciliation = yield* Reconciliation
        yield* reconciliation.check({ userId: user.id })
        yield* (yield* Devnet).mintShares(user.account, "MSFT", BigInt(100_000_000))

        yield* reconciliation.check({ userId: user.id })
        const { notification } = yield* user.events.next("NotificationAdded")
        const lots = yield* (yield* Ledger).openLots(user.id, "MSFT")

        assert.deepStrictEqual(
          [notification.kind, notification.title, notification.link],
          ["balanceUnexplained", "1 share of Microsoft arrived from outside bluechip", "/portfolio"]
        )
        assert.deepStrictEqual(lots.map((lot) => [lot.symbol, lot.agentId, lot.remaining, lot.flagged]), [
          ["MSFT", null, BigInt(100_000_000), true]
        ])
        assert.isTrue(lots[0]!.cost > BigInt(0))
      }))

    it.effect("a stock sent out of the account outside bluechip: what is left stays flagged, and an alert", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const reconciliation = yield* Reconciliation
        const devnet = yield* Devnet
        yield* reconciliation.check({ userId: user.id })
        yield* devnet.mintShares(user.account, "MSFT", BigInt(300_000_000))
        yield* reconciliation.check({ userId: user.id })

        yield* devnet.sendSharesOut(user.account, "MSFT", BigInt(100_000_000))
        yield* reconciliation.check({ userId: user.id })
        const { notification } = yield* user.events.next(
          "NotificationAdded",
          ({ notification }) => notification.title.includes("left")
        )
        const lots = yield* (yield* Ledger).openLots(user.id, "MSFT")

        assert.deepStrictEqual(
          [notification.kind, notification.title, notification.link],
          ["balanceUnexplained", "1 share of Microsoft left your account outside bluechip", "/portfolio"]
        )
        assert.deepStrictEqual(lots.map((lot) => [lot.symbol, lot.remaining, lot.flagged]), [
          ["MSFT", BigInt(200_000_000), true]
        ])
      }))
  })
})
