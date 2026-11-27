import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { Analytics } from "../../../../src/modules/analytics/Analytics.ts"
import { AnalyticsTest } from "../../../utils/AnalyticsTest.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`); analytics goes to memory (`AnalyticsTest`).
layer(TestUsers.layer, { excludeTestServices: true })("Analytics", (it) => {
  describe("capture", () => {
    it.effect("one fact told twice (a workflow step replayed): the same uuid and time, so PostHog keeps one", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const analytics = yield* Analytics
        const fact = { id: "intent_01:filled", at: DateTime.makeUnsafe("2026-11-27T12:00:00Z") }
        const event = {
          _tag: "intent_ended",
          outcome: "filled",
          source: "agent",
          executor: "agent",
          seconds: 2
        } as const

        yield* analytics.capture(user.id, event, fact)
        yield* analytics.capture(user.id, event, fact)
        const told = yield* (yield* AnalyticsTest).messages(user.id)
        const [first, again] = told.filter((message) => message.event === "intent_ended")

        assert.deepStrictEqual([again?.uuid, again?.timestamp], [first?.uuid, "2026-11-27T12:00:00.000Z"])
      }))

    it.effect("a system event: bluechip's own distinct id, with no person", () =>
      Effect.gen(function*() {
        const analytics = yield* Analytics
        const id = `job_${crypto.randomUUID()}`

        yield* analytics.capture(null, {
          _tag: "$ai_embedding",
          $ai_trace_id: id,
          $ai_span_id: id,
          $ai_span_name: "recall",
          $ai_model: "voyage-4",
          $ai_provider: "voyage",
          inputs: 3,
          $ai_latency: 0.2,
          $ai_is_error: false
        }, { id })
        const told = yield* (yield* AnalyticsTest).messages("system:development")
        const sent = told.find((message) => message.properties["$ai_trace_id"] === id)

        assert.deepStrictEqual(
          [sent?.distinct_id, sent?.properties["$process_person_profile"], "$set" in (sent?.properties ?? {})],
          ["system:development", false, false]
        )
      }))
  })
})
