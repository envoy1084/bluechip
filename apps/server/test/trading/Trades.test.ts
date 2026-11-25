import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { call, fundedUser, origin, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"

const prepareTrade = (cookie: string, side: "buy" | "sell", amount: object) =>
  call("POST", "/api/trades", { cookie, body: { requestId: randomUUID(), symbol: "NVDA", side, amount } })

/** A $100 NVDA buy prepared, signed with the user's passkey and confirmed. */
const confirmedBuy = Effect.fnUntraced(function*() {
  const user = yield* fundedUser()
  const prepared = yield* prepareTrade(user.cookie, "buy", { usdc: String(100_000_000) })
  const credential = user.authenticator.authenticate(prepared.json.options.challenge)
  const sent = yield* call("POST", `/api/trades/${prepared.json.id}/confirm`, {
    cookie: user.cookie,
    body: { credential }
  })
  return { ...user, prepared, credential, sent }
})

// A new user with a passkey of their own (an authenticator signs up once), and no money.
const newCookie = Effect.suspend(() =>
  Effect.map(
    signUp(softwareAuthenticator({ rpId: "localhost", origin })),
    (created) => `bluechip_session=${created.session}`
  )
)

layer(DevnetTest.layer)("trades", (it) => {
  describe("POST /api/trades", () => {
    it.effect("InsufficientCash: a buy with no cash", () =>
      Effect.gen(function*() {
        const prepared = yield* prepareTrade(yield* newCookie, "buy", { usdc: "1000000" })

        assert.strictEqual(prepared.json._tag, "InsufficientCash")
      }))

    it.effect("InsufficientShares: a sell with no shares", () =>
      Effect.gen(function*() {
        const prepared = yield* prepareTrade(yield* newCookie, "sell", { shares: "1" })

        assert.strictEqual(prepared.json._tag, "InsufficientShares")
      }))
  })

  describe("POST /api/trades/:id/confirm", () => {
    it.effect("a passkey-signed buy deploys the account and fills at least the quoted minimum", () =>
      Effect.gen(function*() {
        const { events, prepared, sent } = yield* confirmedBuy()

        assert.isTrue(prepared.json.deploysAccount)
        assert.strictEqual(sent.json.status, "confirming")
        const settled = yield* events.next((event) => event._tag === "TradeUpdated" && event.trade.id === sent.json.id)
        assert.strictEqual(settled.trade.status, "filled")
        assert.strictEqual(settled.trade.usdc, String(100_000_000))
        assert.isTrue(BigInt(settled.trade.shares) >= BigInt(prepared.json.quote.minimumOut))
        yield* events.close
      }))

    it.effect("403: the same signature confirmed twice", () =>
      Effect.gen(function*() {
        const { cookie, credential, events, prepared } = yield* confirmedBuy()

        const replay = yield* call("POST", `/api/trades/${prepared.json.id}/confirm`, { cookie, body: { credential } })

        assert.strictEqual(replay.status, 403)
        assert.strictEqual(replay.json.reason, "challenge")
        yield* events.close
      }))

    it.effect("a sell turns shares into cash and shows in activity", () =>
      Effect.gen(function*() {
        const { address, authenticator, cookie, events } = yield* fundedUser()
        yield* (yield* Devnet).mintShares(address, "NVDA", BigInt(100_000_000))

        const prepared = yield* prepareTrade(cookie, "sell", { shares: String(50_000_000) })
        const credential = authenticator.authenticate(prepared.json.options.challenge)
        const sent = yield* call("POST", `/api/trades/${prepared.json.id}/confirm`, { cookie, body: { credential } })
        const settled = yield* events.next((event) => event._tag === "TradeUpdated" && event.trade.id === sent.json.id)

        assert.strictEqual(settled.trade.status, "filled")
        assert.strictEqual(
          (yield* call("GET", "/api/portfolio", { cookie })).json.cash,
          String(BigInt(1_000_000_000) + BigInt(settled.trade.usdc))
        )
        assert.deepStrictEqual(
          (yield* call("GET", "/api/activity?kind=trades", { cookie })).json.items.map((
            item: { _tag: string; trade: { side: string } }
          ) => [item._tag, item.trade.side]),
          [["Trade", "sell"]]
        )
        yield* events.close
      }))
  })
})
