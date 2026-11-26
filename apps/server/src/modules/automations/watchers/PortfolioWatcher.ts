import type { TriggerData } from "@bluechip/domain/automations/Run"
import { sameState, type Step } from "@bluechip/domain/automations/Trigger"
import { stepDrift } from "@bluechip/domain/automations/triggers/Drift"
import { stepPortfolioLevel } from "@bluechip/domain/automations/triggers/PortfolioLevel"
import type { UserId } from "@bluechip/domain/Ids"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import * as Singleton from "effect/cluster/Singleton"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import type { Address } from "viem"
import { Accounts } from "../../accounts/Accounts.ts"
import { AgentStore } from "../../agents/AgentStore.ts"
import { MarketPrices } from "../../market/MarketPrices.ts"
import { AccountBalances } from "../../portfolio/AccountBalances.ts"
import { valueHoldings } from "../../portfolio/Valuation.ts"
import { Automations } from "../Automations.ts"
import { FireAutomation } from "../FireAutomation.ts"

/**
 * The watcher of `drift` and `portfolio` automations: each account's portfolio valued at market prices, read once a
 * minute for the accounts that have one, moving each automation on (which side of its threshold it is) and starting
 * a fire when it crosses, once.
 */
export class PortfolioWatcher extends Context.Service<PortfolioWatcher, {
  readonly check: Effect.Effect<void>
}>()("@bluechip/server/PortfolioWatcher") {
  static readonly layer = Layer.effect(
    PortfolioWatcher,
    Effect.gen(function*() {
      const automations = yield* Automations
      const accounts = yield* Accounts
      const balances = yield* AccountBalances
      const market = yield* MarketPrices
      const agentStore = yield* AgentStore
      const engine = yield* WorkflowEngine.WorkflowEngine

      const check = Effect.gen(function*() {
        const now = yield* DateTime.now
        const at = DateTime.formatIso(now)
        const prices = yield* market.prices

        yield* Effect.forEach(yield* automations.watched("portfolio"), (row) =>
          Effect.gen(function*() {
            const address = (yield* accounts.me(row.userId as UserId)).account.address as Address
            const portfolio = valueHoldings(yield* balances.of(address), prices, now)
            const state = yield* automations.state(row.id)

            let step: Step = { state, fire: null }
            if (row.trigger.type === "portfolio") {
              step = stepPortfolioLevel(row.trigger.config, state, portfolio, at)
            } else if (row.trigger.type === "drift" && row.agentId !== null) {
              const { session } = yield* agentStore.tradingState(row.agentId)
              const config = session === undefined ? undefined : configOf(session.spec.policies, rebalance)
              if (config !== undefined) step = stepDrift(config, state, portfolio, at)
            }
            if (!sameState(step.state, state)) yield* automations.saveState(row.id, step.state)
            if (step.fire === null) return

            const trigger: TriggerData = {
              summary: row.trigger.type === "drift"
                ? "Your mix drifted from its target."
                : "Your portfolio crossed its level.",
              symbol: null,
              price: null,
              newsItemId: null
            }
            yield* FireAutomation.execute({ automationId: row.id, windowKey: step.fire, trigger }, { discard: true })
              .pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine))
          }).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning(`Automation ${row.id}: its portfolio couldn't be read`, cause)
            )
          ))
      }).pipe(Effect.withSpan("PortfolioWatcher.check"))

      return PortfolioWatcher.of({ check })
    })
  )

  /** Every minute, on one runner of the cluster. */
  static readonly watch = Singleton.make(
    "automations.portfolios",
    Effect.gen(function*() {
      const watcher = yield* PortfolioWatcher
      yield* watcher.check.pipe(
        Effect.catchCause((cause) => Effect.logWarning("Portfolio watcher failed", cause)),
        Effect.repeat(Schedule.spaced("1 minute"))
      )
    })
  )
}
