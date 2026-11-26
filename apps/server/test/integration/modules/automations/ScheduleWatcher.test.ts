import { RequestId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { ScheduleWatcher } from "../../../../src/modules/automations/watchers/ScheduleWatcher.ts"
import { GUARDED, weeklyBuy } from "../../../fixtures/Automations.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`); each test names the time it runs the watcher at.
layer(TestUsers.layer, { excludeTestServices: true })("ScheduleWatcher", (it) => {
  describe("runDue", () => {
    it.effect("a Monday buy of your own, due: it asks you, and moves to the next Monday", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: weeklyBuy(null) }
        })
        const due = saved.nextRunAt!

        yield* (yield* ScheduleWatcher).runDue(DateTime.add(due, { seconds: 1 }), { userId: user.id })
        const { intent } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.source === "automation" && intent.status === "needsApproval"
        )
        const detail = yield* user.api.automations.automation({ params: { id: saved.id } })

        assert.deepStrictEqual(
          [
            intent.decision,
            intent.leg,
            detail.runs.map((run) => [run.windowKey, run.outcome]),
            DateTime.distance(due, detail.automation.nextRunAt!)
          ],
          [
            { _tag: "Ask" },
            { symbol: "NVDA", side: "buy", amount: { usdc: 50_000_000n } },
            [[`schedule:${DateTime.formatIso(due)}`, "asked"]],
            DateTime.distance(due, DateTime.add(due, { days: 7 }))
          ]
        )
      }))

    it.effect("a minute before it is due: nothing", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: weeklyBuy(null) }
        })

        yield* (yield* ScheduleWatcher).runDue(DateTime.subtract(saved.nextRunAt!, { minutes: 1 }), { userId: user.id })
        const detail = yield* user.api.automations.automation({ params: { id: saved.id } })

        assert.deepStrictEqual([detail.runs, detail.automation.nextRunAt], [[], saved.nextRunAt])
      }))

    it.effect("the trade it asks about, approved, is signed with your passkey and filled", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: weeklyBuy(null, GUARDED) }
        })
        yield* (yield* ScheduleWatcher).runDue(DateTime.add(saved.nextRunAt!, { seconds: 1 }), { userId: user.id })
        const { intent } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.source === "automation" && intent.status === "needsApproval"
        )

        const request = yield* user.api.intents.approve({
          params: { id: intent.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })
        yield* user.api.intents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        })
        const { intent: filled } = yield* user.events.next(
          "IntentChanged",
          (event) => event.intent.id === intent.id && event.intent.status === "filled"
        )

        assert.deepStrictEqual([filled.executor, filled.agentId, filled.source], ["owner", null, "automation"])
      }))
  })
})
