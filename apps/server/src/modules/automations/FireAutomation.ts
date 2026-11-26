import { TriggerData } from "@bluechip/domain/automations/Run"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import * as Workflow from "effect/workflow/Workflow"
import { AutomationRunner } from "./AutomationRunner.ts"

/**
 * One fire of an automation: keyed by the automation and its window, so a window fires once however often a watcher
 * starts it, across restarts too. Its one step runs the fire; a step cut short by a restart runs again and finishes
 * the run it started.
 */
export const FireAutomation = Workflow.make("FireAutomation", {
  payload: { automationId: Schema.String, windowKey: Schema.String, trigger: TriggerData },
  idempotencyKey: ({ automationId, windowKey }) => `${automationId}:${windowKey}`
})

export const FireAutomationLive = FireAutomation.toLayer(
  Effect.fnUntraced(function*({ automationId, trigger, windowKey }) {
    const runner = yield* AutomationRunner
    yield* Activity.make({
      name: "fire",
      execute: runner.fire(automationId, windowKey, trigger)
    })
  })
)
