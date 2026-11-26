import { NotFound } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { buy } from "../../fixtures/Legs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("agents' journals", (it) => {
  describe("GET /api/agents/:id/journal", () => {
    it.effect("what the agent did, newest first, a page at a time", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )
        yield* user.api.intents.decline({ params: { id: created.id } })

        const first = yield* user.api.agents.journal({ params: { id: agent.id }, query: { pageSize: 1 } })
        const second = yield* user.api.agents.journal({
          params: { id: agent.id },
          query: { pageSize: 1, pageToken: first.nextPageToken! }
        })

        assert.deepStrictEqual(
          [first.items.map((entry) => [entry.kind, entry.entry]), second.items.map((entry) => entry.kind)],
          [[["intent", "Buy $150.00 of NVIDIA: you declined it."]], ["intent"]]
        )
        assert.match(
          second.items[0]!.entry,
          /^Buy \$150\.00 of NVIDIA\. Over its \$100 limit, so it needs your approval/
        )
        assert.isNull(second.nextPageToken)
      }))

    it.effect("an agent that hasn't done anything: an empty page", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const page = yield* user.api.agents.journal({ params: { id: agent.id }, query: {} })

        assert.deepStrictEqual(page, { items: [], nextPageToken: null })
      }))

    it.effect("404: another user's agent", () =>
      Effect.gen(function*() {
        const { agent } = yield* (yield* TestAgents).locked
        const { api } = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(api.agents.journal({ params: { id: agent.id }, query: {} }))

        assert.deepStrictEqual(error, new NotFound({ resource: "agent", id: agent.id }))
      }))
  })
})
