import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { call, handler, origin, signIn, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"
import { chainAvailable } from "../support/fork.ts"

describe.skipIf(!chainAvailable)("BluechipApi", () => {
  it.effect("version answers without a session", () =>
    Effect.gen(function*() {
      const version = yield* call("GET", "/api/version")
      assert.strictEqual(version.status, 200)
      assert.strictEqual(version.json.contract, ContractVersion)
    }))

  it.effect("an outdated client gets ClientOutdated (426)", () =>
    Effect.gen(function*() {
      const response = yield* Effect.promise(() =>
        handler(new Request("http://localhost/api/version", { headers: { [contractVersionHeader]: "999" } }))
      )
      assert.strictEqual(response.status, 426)
    }))

  it.effect("a passkey signs up, keeps a session, signs out and signs back in to the same account", () =>
    Effect.gen(function*() {
      const authenticator = softwareAuthenticator({ rpId: "localhost", origin })
      const created = yield* signUp(authenticator)
      assert.strictEqual(created.status, 200)
      assert.isDefined(created.session)
      assert.match(created.json.account.address, /^0x[0-9a-fA-F]{40}$/)
      assert.strictEqual(created.json.user.eligibility, "unknown")

      const me = yield* call("GET", "/api/account", { cookie: `bluechip_session=${created.session}` })
      assert.strictEqual(me.status, 200)
      assert.strictEqual(me.json.account.address, created.json.account.address)
      assert.isFalse(me.json.account.deployed)

      const eligible = yield* call("POST", "/api/account/eligibility", {
        cookie: `bluechip_session=${created.session}`,
        body: { answer: "outsideUs" }
      })
      assert.strictEqual(eligible.json.eligibility, "outsideUs")

      const events = yield* call("GET", "/api/events", { cookie: `bluechip_session=${created.session}` })
      assert.strictEqual(events.status, 200)
      yield* Effect.promise(() => events.response.body!.cancel())

      const out = yield* call("POST", "/api/auth/logout", { cookie: `bluechip_session=${created.session}` })
      assert.strictEqual(out.status, 204)
      const after = yield* call("GET", "/api/account", { cookie: `bluechip_session=${created.session}` })
      assert.strictEqual(after.status, 401)

      const { result } = yield* signIn(authenticator)
      assert.strictEqual(result.status, 200)
      assert.strictEqual(result.json.account.address, created.json.account.address)
      const again = yield* call("GET", "/api/account", { cookie: `bluechip_session=${result.session}` })
      assert.strictEqual(again.json.user.eligibility, "outsideUs")

      const passkeys = yield* call("GET", "/api/account/passkeys", { cookie: `bluechip_session=${result.session}` })
      assert.strictEqual(passkeys.json.length, 1)
      assert.strictEqual(passkeys.json[0].label, "Passkey")
      assert.isTrue(passkeys.json[0].current)
    }))

  it.effect("the name can be set and cleared", () =>
    Effect.gen(function*() {
      const created = yield* signUp(softwareAuthenticator({ rpId: "localhost", origin }))
      const cookie = `bluechip_session=${created.session}`
      const named = yield* call("POST", "/api/account/display-name", { cookie, body: { displayName: "  Grace " } })
      assert.strictEqual(named.json.displayName, "Grace")
      const cleared = yield* call("POST", "/api/account/display-name", { cookie, body: { displayName: "" } })
      assert.isNull(cleared.json.displayName)
    }))

  it.effect("signed-in endpoints refuse requests without a session", () =>
    Effect.gen(function*() {
      assert.strictEqual((yield* call("GET", "/api/account")).status, 401)
      assert.strictEqual((yield* call("GET", "/api/events")).status, 401)
      assert.strictEqual((yield* call("GET", "/api/account", { cookie: "bluechip_session=forged" })).status, 401)
    }))

  it.effect("a challenge verifies once", () =>
    Effect.gen(function*() {
      const authenticator = softwareAuthenticator({ rpId: "localhost", origin })
      yield* signUp(authenticator)
      const { body } = yield* signIn(authenticator)
      const replay = yield* call("POST", "/api/auth/login/verify", { body })
      assert.strictEqual(replay.status, 403)
      assert.strictEqual(replay.json.reason, "challenge")
    }))

  it.effect("a passkey from another site, an unknown passkey and a rewound counter are rejected", () =>
    Effect.gen(function*() {
      const phishing = softwareAuthenticator({ rpId: "localhost", origin: "https://evil.example" })
      const ceremony = yield* call("POST", "/api/auth/register/options", { body: {} })
      const wrongOrigin = yield* call("POST", "/api/auth/register/verify", {
        body: { challengeId: ceremony.json.challengeId, credential: phishing.register(ceremony.json.options.challenge) }
      })
      assert.strictEqual(wrongOrigin.status, 403)

      const stranger = softwareAuthenticator({ rpId: "localhost", origin })
      assert.strictEqual((yield* signIn(stranger)).result.json.reason, "unknownPasskey")

      const cloned = softwareAuthenticator({ rpId: "localhost", origin })
      yield* signUp(cloned)
      yield* signIn(cloned)
      yield* signIn(cloned)
      cloned.rewindCounter()
      const { result } = yield* signIn(cloned)
      assert.strictEqual(result.status, 403)
    }))

  it.effect("serves the market without a session", () =>
    Effect.gen(function*() {
      const status = yield* call("GET", "/api/market/status")
      assert.include(["regular", "preMarket", "afterHours", "overnight", "paused"], status.json.session)

      // Market prices come from Alpaca's test layer ($100 a share, previous close $98), references from the fork.
      const stocks = yield* call("GET", "/api/market/stocks")
      assert.strictEqual(stocks.json.length, 13)
      assert.isTrue(stocks.json.every((stock: { tradable: boolean }) => stock.tradable))
      const msft = stocks.json.find((stock: { symbol: string }) => stock.symbol === "MSFT")
      assert.strictEqual(msft.price.price, "10000000000")
      assert.strictEqual(msft.change24h, 204)
      assert.isNotNull(msft.reference)

      const quote = yield* call("POST", "/api/market/quotes", {
        body: { symbol: "NVDA", side: "buy", amount: { usdc: "100000000" } }
      })
      assert.strictEqual(quote.status, 200)
      assert.isAbove(Number(quote.json.shares), 0)
      assert.isBelow(Math.abs(quote.json.gapBps), 200)
      const history = yield* call("GET", "/api/market/stocks/MSFT/history?range=1W")
      assert.deepStrictEqual(history.json.map((point: { price: string }) => point.price), ["9800000000", "10000000000"])
    }))

  it.effect("cross-site requests are refused", () =>
    Effect.gen(function*() {
      const forged = yield* call("POST", "/api/auth/logout", { origin: "https://evil.example" })
      assert.strictEqual(forged.status, 403)
    }))
})
