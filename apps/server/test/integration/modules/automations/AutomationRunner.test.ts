import { Shares } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { AutomationRunner } from "../../../../src/modules/automations/AutomationRunner.ts"
import { AutomationRuns } from "../../../../src/modules/automations/AutomationRuns.ts"
import { AROUND_THE_CLOCK, GUARDED, stopLoss, TEST_FIRE } from "../../../fixtures/Automations.ts"
import { TestAutomations } from "../../../utils/TestAutomations.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAutomations.layer, { excludeTestServices: true })("AutomationRunner", (it) => {
  describe("fire", () => {
    it.effect("fired twice for one window (a restart mid-fire), it proposes its two sales once", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, { symbol: GUARDED, settings: AROUND_THE_CLOCK })
        )
        const runner = yield* AutomationRunner

        yield* runner.fire(automation.id, "test:1", TEST_FIRE)
        yield* runner.fire(automation.id, "test:1", TEST_FIRE)
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })
        const intents = yield* user.api.intents.list({ query: { source: "automation" } })

        assert.deepStrictEqual(
          [
            detail.runs.map((run) => [run.outcome, run.reason, run.intentIds.length]),
            intents.items.length,
            detail.automation.fires
          ],
          [[["proposed", "Proposed 2 trades.", 2]], 2, 1]
        )
      }))

    it.effect("a run a restart left running is finished, proposing once", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, { symbol: GUARDED, settings: AROUND_THE_CLOCK })
        )
        yield* (yield* AutomationRuns).start({
          automationId: automation.id,
          userId: user.id,
          windowKey: "test:1",
          trigger: TEST_FIRE
        })

        yield* (yield* AutomationRunner).fire(automation.id, "test:1", TEST_FIRE)
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual(detail.runs.map((run) => [run.outcome, run.intentIds.length]), [["proposed", 2]])
      }))

    it.effect("its agent paused: skipped, saying why", () =>
      Effect.gen(function*() {
        const { agent, automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, { symbol: GUARDED, settings: AROUND_THE_CLOCK })
        )
        yield* user.api.agents.pause({ params: { id: agent.id } })

        yield* (yield* AutomationRunner).fire(automation.id, "test:1", TEST_FIRE)
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual(
          detail.runs.map((run) => [run.outcome, run.reason, run.intentIds]),
          [["skipped", "Its agent is paused or can't trade.", []]]
        )
      }))

    it.effect("a second window within its hour's cooldown: skipped", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, { symbol: GUARDED, settings: AROUND_THE_CLOCK })
        )
        const runner = yield* AutomationRunner

        yield* runner.fire(automation.id, "test:1", TEST_FIRE)
        yield* runner.fire(automation.id, "test:2", TEST_FIRE)
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual(
          detail.runs.map((run) => [run.windowKey, run.outcome, run.reason]),
          [["test:2", "skipped", "It fired less than its cooldown ago."], ["test:1", "proposed", "Proposed 2 trades."]]
        )
      }))

    it.effect("its only fire done: the automation ends", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, { symbol: GUARDED, settings: { ...AROUND_THE_CLOCK, maxFires: 1 } })
        )

        yield* (yield* AutomationRunner).fire(automation.id, "test:1", TEST_FIRE)
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual([detail.automation.status, detail.automation.fires], ["done", 1])
      }))

    it.effect("a condition that fails: skipped, with the condition's reason", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, {
            symbol: GUARDED,
            settings: AROUND_THE_CLOCK,
            conditions: [{ type: "holdingAtLeast", config: { symbol: GUARDED, shares: Shares.make(300_000_000n) } }]
          })
        )

        yield* (yield* AutomationRunner).fire(automation.id, "test:1", TEST_FIRE)
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual(
          detail.runs.map((run) => [run.outcome, run.reason, run.conditions.map((record) => record.pass)]),
          [["skipped", "You hold 2.5 shares of META.", [false]]]
        )
      }))
  })
})
