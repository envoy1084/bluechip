import { FaucetLimitReached, InvalidRequest } from "@bluechip/domain/Errors"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`). On the local chain the faucet sends from the devnet's controls.
layer(TestUsers.layer, { excludeTestServices: true })("faucet", (it) => {
  describe("GET /api/faucet", () => {
    it.effect("200: a new account can get the whole $10,000 today, until midnight UTC", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const allowance = yield* api.faucet.allowance()

        assert.deepStrictEqual(
          { limit: allowance.limit, remaining: allowance.remaining },
          { limit: BigInt(10_000_000_000), remaining: BigInt(10_000_000_000) }
        )
        assert.match(DateTime.formatIso(allowance.resetsAt), /T00:00:00\.000Z$/)
      }))
  })

  describe("POST /api/faucet", () => {
    it.effect("200: $1,000 arrives as cash, and $9,000 is left today", () =>
      Effect.gen(function*() {
        const { api, events } = yield* (yield* TestUsers).signUp

        const grant = yield* api.faucet.claim({ payload: { amount: Usdc.make(BigInt(1_000_000_000)) } })
        yield* events.next("PortfolioChanged")
        const portfolio = yield* api.portfolio.portfolio()

        assert.deepStrictEqual(
          { amount: grant.amount, txHash: grant.txHash, remaining: grant.allowance.remaining },
          { amount: BigInt(1_000_000_000), txHash: null, remaining: BigInt(9_000_000_000) }
        )
        assert.strictEqual(portfolio.cash, BigInt(1_000_000_000))
      }))

    it.effect("200: the rest of the day's allowance, to the cent, leaves nothing", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        yield* api.faucet.claim({ payload: { amount: Usdc.make(BigInt(9_999_990_000)) } })

        const grant = yield* api.faucet.claim({ payload: { amount: Usdc.make(BigInt(10_000)) } })
        const allowance = yield* api.faucet.allowance()

        assert.strictEqual(grant.allowance.remaining, BigInt(0))
        assert.strictEqual(allowance.remaining, BigInt(0))
      }))

    it.effect("FaucetLimitReached: a cent more than is left today, and nothing is sent", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        yield* api.faucet.claim({ payload: { amount: Usdc.make(BigInt(9_000_000_000)) } })

        const error = yield* Effect.flip(api.faucet.claim({ payload: { amount: Usdc.make(BigInt(1_000_010_000)) } }))
        const portfolio = yield* api.portfolio.portfolio()

        assert.instanceOf(error, FaucetLimitReached)
        assert.strictEqual((error as FaucetLimitReached).remaining, BigInt(1_000_000_000))
        assert.strictEqual(portfolio.cash, BigInt(9_000_000_000))
      }))

    it.effect("FaucetLimitReached: two claims at once that don't both fit, one of them sent", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const claim = api.faucet.claim({ payload: { amount: Usdc.make(BigInt(6_000_000_000)) } })

        const results = yield* Effect.all([Effect.result(claim), Effect.result(claim)], { concurrency: 2 })
        const allowance = yield* api.faucet.allowance()

        assert.deepStrictEqual(results.map((result) => result._tag).sort(), ["Failure", "Success"])
        assert.strictEqual(allowance.remaining, BigInt(4_000_000_000))
      }))

    it.effect("InvalidRequest: nothing asked for", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(api.faucet.claim({ payload: { amount: Usdc.make(BigInt(0)) } }))

        assert.deepStrictEqual({ ...error }, { ...new InvalidRequest({ field: "amount", problem: "outOfRange" }) })
      }))
  })
})
