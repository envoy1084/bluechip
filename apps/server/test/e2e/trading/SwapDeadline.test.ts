import { DevChain } from "@bluechip/chain/DevChain"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { buy } from "../../fixtures/Legs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"

// A swap's deadline is checked against `block.timestamp`, so it must count from the chain's clock, not the server's:
// each test runs the chain an hour ahead of the server (as a chain behind on its clock, or a fork moved forward, would
// be). On Base's hardfork Anvil never moves its clock back, so these tests run on a devnet of their own. Feeds updated
// at the real time are still fresh an hour later.
// The server runs on the real clock (see `TestServer`).
const AHEAD_MS = 60 * 60 * 1000

layer(TestAgents.layerIsolated, { excludeTestServices: true })("swap deadlines", (it) => {
  describe("with the chain's clock an hour ahead of the server's", () => {
    it.effect("an agent's buy is sent and filled", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        yield* Effect.orDie((yield* DevChain).setTime(new Date(Date.now() + AHEAD_MS)))

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("AAPL", 20) }
        })
        assert.instanceOf(created, Intent)
        const { intent: filled } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && (intent.status === "filled" || intent.status === "waiting")
        )

        assert.deepStrictEqual([filled.status, filled.decision?._tag], ["filled", "Passes"])
      }))

    it.effect("your own buy signed with your passkey is filled", () =>
      Effect.gen(function*() {
        const { user } = yield* (yield* TestAgents).locked
        yield* Effect.orDie((yield* DevChain).setTime(new Date(Date.now() + AHEAD_MS)))

        const request = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: null, leg: buy("AAPL", 20) }
        })
        assert.instanceOf(request, IntentRequest)
        yield* user.api.intents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        })
        const { intent: filled } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === request.intent.id && (intent.status === "filled" || intent.status === "failed")
        )

        assert.strictEqual(filled.status, "filled")
      }))
  })
})
