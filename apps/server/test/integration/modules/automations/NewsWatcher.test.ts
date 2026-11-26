import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { NewsWatcher } from "../../../../src/modules/automations/watchers/NewsWatcher.ts"
import { badNews, story } from "../../../fixtures/Automations.ts"
import { RecordedModel } from "../../../utils/RecordedModel.ts"
import { TestAutomations } from "../../../utils/TestAutomations.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAutomations.layer, { excludeTestServices: true })("NewsWatcher", (it) => {
  describe("receive", () => {
    it.effect("materially bad news about Meta, judged 90% sure: asks you to sell half, the judgment logged", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded(badNews)
        const headline = `Meta cuts its guidance ${randomUUID()}`
        yield* (yield* RecordedModel).judge(headline, { verdict: true, confidence: 0.9, reason: "Guidance cut." })

        yield* (yield* NewsWatcher).receive([story(headline)], { userId: user.id })
        const { intent } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.source === "automation" && intent.status === "needsApproval"
        )
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual(
          [
            intent.decision,
            detail.runs.map((run) => [run.outcome, run.conditions.map((record) => record.reason)]),
            detail.judgments.map((judgment) => [judgment.preset, judgment.inputs.headline, judgment.answer])
          ],
          [
            { _tag: "Ask" },
            [["asked", ["The model said yes (90% sure): Guidance cut."]]],
            [["materiallyNegative", headline, { verdict: true, confidence: 0.9, reason: "Guidance cut." }]]
          ]
        )
        assert.match(detail.runs[0]!.windowKey, /^news:news_/)
      }))

    it.effect("the same story twice fires once", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded(badNews)
        const headline = `Meta recalls its glasses ${randomUUID()}`
        yield* (yield* RecordedModel).judge(headline, { verdict: true, confidence: 0.8, reason: "A recall." })
        const watcher = yield* NewsWatcher
        const sourceId = randomUUID()

        yield* watcher.receive([story(headline, { sourceId })], { userId: user.id })
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.source === "automation" && intent.status === "needsApproval"
        )
        yield* watcher.receive([story(headline, { sourceId })], { userId: user.id })
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.strictEqual(detail.runs.length, 1)
      }))

    it.effect("a story about another stock fires nothing", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded(badNews)

        yield* (yield* NewsWatcher).receive([story(`Tesla deliveries fall ${randomUUID()}`, { symbols: ["TSLA"] })], {
          userId: user.id
        })
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual(detail.runs, [])
      }))
  })
})
