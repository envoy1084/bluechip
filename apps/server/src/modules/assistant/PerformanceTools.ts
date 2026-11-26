import type { NotFound } from "@bluechip/domain/Errors"
import { Caller, ToolProblem } from "@bluechip/domain/tools/Caller"
import { PerformanceToolkit } from "@bluechip/domain/tools/PerformanceTools"
import * as Effect from "effect/Effect"
import { Performance } from "../performance/Performance.ts"

const asProblem = Effect.mapError((failure: NotFound) =>
  new ToolProblem({ problem: `There is no ${failure.resource} ${failure.id} for this user.` })
)

/** The performance tools' handlers, for the user in `Caller`: reads of the ledger, nothing else. */
export const PerformanceToolsLive = PerformanceToolkit.toLayer(Effect.gen(function*() {
  const performance = yield* Performance

  return PerformanceToolkit.of({
    getPerformance: Effect.fn("AssistantTools.getPerformance")(function*() {
      return yield* performance.portfolio((yield* Caller).id)
    }),
    getStockPerformance: Effect.fn("AssistantTools.getStockPerformance")(function*({ symbol }) {
      return yield* performance.stock((yield* Caller).id, symbol)
    }),
    getAgentPerformance: Effect.fn("AssistantTools.getAgentPerformance")(function*({ agentId }) {
      return yield* performance.agent(yield* Caller, agentId)
    }, asProblem),
    getAutomationPerformance: Effect.fn("AssistantTools.getAutomationPerformance")(function*({ automationId }) {
      return yield* performance.automation(yield* Caller, automationId)
    }, asProblem)
  })
}))
