import { DevChain } from "@bluechip/chain/DevChain"
import { Devnet } from "@bluechip/devnet/Devnet"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { buy } from "../../fixtures/Legs.ts"
import { changed, PICKER } from "../../fixtures/Specs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// Prices follow the chain's clock, so each test moves it to a fixed day, and back to now afterwards: the worker's
// chain is shared, and its feeds and sessions are dated by the real clock. The server reads prices uncached.
// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("price waits", (it) => {
  describe("POST /api/intents through an agent", () => {
    it.effect("on a Saturday, an agent that doesn't trade on paused prices waits (pricesPaused)", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const user = yield* (yield* TestUsers).funded
        const request = yield* Effect.orDie(agents.create(user, {
          spec: changed(PICKER, { id: "fairPrice", config: { tradeWhilePaused: false } })
        }))
        const { agent } = yield* agents.sign(user, request, "active")
        const chain = yield* DevChain
        yield* chain.setTime(new Date("2026-11-28T17:00:00Z"))

        const waiting = yield* Effect.gen(function*() {
          const created = yield* user.api.intents.create({
            payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
          })
          assert.instanceOf(created, Intent)
          const { intent } = yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.id === created.id && intent.status === "waiting"
          )
          return intent
        }).pipe(Effect.ensuring(Effect.orDie(chain.setTime(new Date()))))

        assert.deepStrictEqual(
          waiting.decision?._tag === "Wait" ? [waiting.decision.reason, waiting.tradeId] : [],
          ["pricesPaused", null]
        )
      }))

    it.effect("on a market day, a feed past its 24-hour heartbeat makes the trade wait (pricesStale)", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const devnet = yield* Devnet
        const chain = yield* DevChain
        const stocks = yield* user.api.market.stocks()
        const price = stocks.find((stock) => stock.symbol === "AAPL")!.reference!.price
        // A Wednesday, 10 am in New York; the feed last updated two days before.
        const wednesday = new Date("2026-12-02T15:00:00Z")
        yield* devnet.setPrice("AAPL", price, {
          ageSeconds: Math.floor((Date.now() - wednesday.getTime()) / 1000) + 2 * 86_400
        })
        yield* chain.setTime(wednesday)

        const waiting = yield* Effect.gen(function*() {
          const created = yield* user.api.intents.create({
            payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("AAPL", 50) }
          })
          assert.instanceOf(created, Intent)
          const { intent } = yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.id === created.id && intent.status === "waiting"
          )
          return intent
        }).pipe(
          Effect.ensuring(Effect.andThen(Effect.orDie(chain.setTime(new Date())), devnet.setPrice("AAPL", price)))
        )

        assert.deepStrictEqual(
          waiting.decision?._tag === "Wait" ? [waiting.decision.reason, waiting.tradeId] : [],
          ["pricesStale", null]
        )
      }))
  })
})
