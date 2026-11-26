import { ChainClient } from "@bluechip/chain/ChainClient"
import { DevChain } from "@bluechip/chain/DevChain"
import { Devnet } from "@bluechip/devnet/Devnet"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { buy } from "../../fixtures/Legs.ts"
import { nextMarketDay, nextSaturday } from "../../fixtures/MarketDays.ts"
import { changed, PICKER } from "../../fixtures/Specs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// Prices follow the chain's clock, so each test moves it ahead to the next day of the kind it needs, whatever today
// is. On Base's hardfork Anvil never moves its clock back, so these tests run on a devnet of their own; the worker's
// chain is shared by every file it runs. The server reads prices uncached.
// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layerIsolated, { excludeTestServices: true })("price waits", (it) => {
  describe("POST /api/intents through an agent", () => {
    it.effect("on a Saturday, an agent that doesn't trade on paused prices waits (pricesPaused)", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const user = yield* (yield* TestUsers).funded
        const request = yield* Effect.orDie(agents.create(user, {
          spec: changed(PICKER, { id: "fairPrice", config: { tradeWhilePaused: false } })
        }))
        const { agent } = yield* agents.sign(user, request, "active")
        const block = yield* (yield* ChainClient).use("latest block", (client) => client.getBlock())
        yield* Effect.orDie((yield* DevChain).setTime(nextSaturday(block.timestamp)))

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
        })
        assert.instanceOf(created, Intent)
        const { intent: waiting } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "waiting"
        )

        assert.deepStrictEqual(
          waiting.decision?._tag === "Wait" ? [waiting.decision.reason, waiting.tradeId] : [],
          ["pricesPaused", null]
        )
      }))

    it.effect("on a market day, a feed past its 24-hour heartbeat makes the trade wait (pricesStale)", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const stocks = yield* user.api.market.stocks()
        const price = stocks.find((stock) => stock.symbol === "AAPL")!.reference!.price
        const block = yield* (yield* ChainClient).use("latest block", (client) => client.getBlock())
        // The morning of the next market day; the feed last updated two days before.
        const marketDay = nextMarketDay(block.timestamp)
        yield* (yield* Devnet).setPrice("AAPL", price, {
          ageSeconds: Math.floor((Date.now() - marketDay.getTime()) / 1000) + 2 * 86_400
        })
        yield* Effect.orDie((yield* DevChain).setTime(marketDay))

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("AAPL", 50) }
        })
        assert.instanceOf(created, Intent)
        const { intent: waiting } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "waiting"
        )

        assert.deepStrictEqual(
          waiting.decision?._tag === "Wait" ? [waiting.decision.reason, waiting.tradeId] : [],
          ["pricesStale", null]
        )
      }))
  })
})
