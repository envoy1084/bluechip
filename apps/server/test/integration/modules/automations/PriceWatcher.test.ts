import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Automations } from "../../../../src/modules/automations/Automations.ts"
import { PriceWatcher } from "../../../../src/modules/automations/watchers/PriceWatcher.ts"
import { AROUND_THE_CLOCK, nvidiaAt, nvidiaStopLoss } from "../../../fixtures/Automations.ts"
import { TestAutomations } from "../../../utils/TestAutomations.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAutomations.layer, { excludeTestServices: true })("PriceWatcher", (it) => {
  describe("observe", () => {
    it.effect("NVIDIA 11% under its high fires its sale once, split within the agent's $100 largest trade", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          nvidiaStopLoss(agentId, { settings: AROUND_THE_CLOCK })
        )
        const watcher = yield* PriceWatcher

        yield* watcher.observe([nvidiaAt(100)])
        yield* watcher.observe([nvidiaAt(89)])
        const first = yield* user.events.next("IntentChanged", ({ intent }) => intent.source === "automation")
        const second = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.source === "automation" && intent.id !== first.intent.id
        )
        yield* watcher.observe([nvidiaAt(85)])
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })
        const state = yield* (yield* Automations).state(automation.id)

        assert.deepStrictEqual(
          [
            detail.runs.map((run) => [run.windowKey, [...run.intentIds].sort()]),
            [first.intent.leg, second.intent.leg],
            state.lastWindow
          ],
          [
            [["high:10000000000", [first.intent.id, second.intent.id].sort()]],
            [
              { symbol: "NVDA", side: "sell", amount: { shares: 62_500_000n } },
              { symbol: "NVDA", side: "sell", amount: { shares: 62_500_000n } }
            ],
            "high:10000000000"
          ]
        )
      }))

    it.effect("a paused automation never fires", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded(
          (agentId) => nvidiaStopLoss(agentId, { settings: AROUND_THE_CLOCK }),
          {
            paused: true
          }
        )
        const watcher = yield* PriceWatcher

        yield* watcher.observe([nvidiaAt(100)])
        yield* watcher.observe([nvidiaAt(80)])
        const detail = yield* user.api.automations.automation({ params: { id: automation.id } })

        assert.deepStrictEqual(detail.runs, [])
      }))
  })
})
