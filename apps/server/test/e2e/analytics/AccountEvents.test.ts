import { DevChain } from "@bluechip/chain/DevChain"
import { RequestId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { Reconciliation } from "../../../src/modules/ledger/Reconciliation.ts"
import { AnalyticsTest } from "../../utils/AnalyticsTest.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`); analytics goes to memory (`AnalyticsTest`).
layer(TestUsers.layer, { excludeTestServices: true })("analytics: account and money", (it) => {
  describe("sign-up and onboarding", () => {
    it.effect("a sign-up: signed_up, with when they joined and their network", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const [message] = yield* (yield* AnalyticsTest).messages(user.id)

        // Tests run without an exporting tracer, so there is no trace id to stamp.
        assert.match(message!.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        assert.match(message!.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        assert.deepStrictEqual({ ...message!, uuid: "uuid", timestamp: "timestamp" }, {
          event: "signed_up",
          distinct_id: user.id,
          uuid: "uuid",
          timestamp: "timestamp",
          properties: {
            method: "passkey",
            authenticator: "platform",
            device_class: "desktop",
            network: "local",
            environment: "development",
            app_version: "test",
            $set: { network: "local", passkeys_count: 1 },
            $set_once: { signed_up_at: message!.timestamp },
            $process_person_profile: true
          }
        })
      }))

    it.effect("eligibility answered outside the US: eligibility_answered, eligible", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        yield* user.api.account.setEligibility({ payload: { answer: "outsideUs" } })
        const told = yield* (yield* AnalyticsTest).told(user.id, "eligibility_answered")

        assert.deepStrictEqual(told, [{
          event: "eligibility_answered",
          properties: { answer: "eligible", $set: { network: "local", eligibility: "eligible" } }
        }])
      }))

    it.effect("a sign-in on another browser: signed_in, on a new device", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const user = yield* users.signUp
        const other = yield* users.browser
        const ceremony = yield* other.api.auth.loginOptions()

        yield* other.api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: user.authenticator.authenticate(ceremony.options) }
        })
        const told = yield* (yield* AnalyticsTest).told(user.id, "signed_in")

        assert.deepStrictEqual(told, [{
          event: "signed_in",
          properties: { method: "discoverable", new_device: false, $set: { network: "local" } }
        }])
      }))
  })

  describe("money in", () => {
    it.effect("a first deposit of $250: deposit_detected and first_funded, with the person funded", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        yield* (yield* DevChain).sendUsdc(user.account, BigInt(250_000_000))

        yield* (yield* Reconciliation).check({ userId: user.id })
        const told = yield* (yield* AnalyticsTest).told(user.id, "deposit_detected", "first_funded")

        const [deposit, funded] = told
        const set = { network: "local", has_funded: true, funded_bucket: "$100–1k" }

        const once = deposit?.properties["$set_once"] as { readonly first_funded_at: string }
        assert.match(once.first_funded_at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
        assert.isBelow(funded?.properties["hours_since_signup"] as number, 1)
        assert.deepStrictEqual(told.map(({ event }) => event), ["deposit_detected", "first_funded"])
        assert.deepStrictEqual({ ...deposit!.properties, $set_once: null }, {
          usd: 250,
          usd_bucket: "$100–500",
          is_first: true,
          $set: set,
          $set_once: null
        })
        assert.deepStrictEqual({ ...funded!.properties, hours_since_signup: 0, $set_once: null }, {
          usd_bucket: "$100–500",
          hours_since_signup: 0,
          $set: set,
          $set_once: null
        })
      }))

    it.effect("test money from the faucet: faucet_minted with its dollars", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        yield* user.api.faucet.claim({ payload: { amount: Usdc.make(BigInt(1_000_000_000)) } })
        const told = yield* (yield* AnalyticsTest).told(user.id, "faucet_minted")

        assert.deepStrictEqual(told, [{
          event: "faucet_minted",
          properties: { usd: 1000, $set: { network: "local" } }
        }])
      }))
  })

  describe("trading", () => {
    it.effect("a $100 passkey buy: quote_requested, trade_signed, then trade_filled with exact dollars", () =>
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
        yield* user.events.next("TradeUpdated", ({ trade }) => trade.id === sent.id && trade.status === "filled")
        const told = yield* (yield* AnalyticsTest).told(user.id, "quote_requested", "trade_signed", "trade_filled")
        const filled = told[2]!.properties

        assert.deepStrictEqual(told.slice(0, 2), [
          {
            event: "quote_requested",
            properties: { symbol: "NVDA", side: "buy", usd_bucket: "$100–500", $set: { network: "local" } }
          },
          {
            event: "trade_signed",
            properties: { symbol: "NVDA", side: "buy", usd_bucket: "$100–500", $set: { network: "local" } }
          }
        ])
        assert.deepStrictEqual({ ...filled, slippage_bps: 0, fee_usd: 0, seconds_to_fill: 0, $set_once: null }, {
          symbol: "NVDA",
          side: "buy",
          usd: 100,
          usd_bucket: "$100–500",
          source: "you",
          executor: "owner",
          agent_id: null,
          automation_id: null,
          batch_id: null,
          slippage_bps: 0,
          fee_usd: 0,
          gas_sponsored: false,
          is_first: true,
          seconds_to_fill: 0,
          $set: { network: "local", trades_count: 1 },
          $set_once: null
        })
      }))
  })
})
