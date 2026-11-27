import type { TriggerData } from "@bluechip/domain/automations/Run"
import type { Step } from "@bluechip/domain/automations/Trigger"
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
  /** Reads the portfolios of everyone's automations (or one user's). */
  readonly check: (options?: { readonly userId?: UserId | undefined }) => Effect.Effect<void>
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

      const check = Effect.fn("PortfolioWatcher.check")(
        function*(options: { readonly userId?: UserId | undefined } = {}) {
          const now = yield* DateTime.now
          const at = DateTime.formatIso(now)
          const prices = yield* market.prices
          let fired = 0

          yield* Effect.forEach(
            yield* automations.watched("portfolio", options.userId),
            (row) =>
              Effect.gen(function*() {
                const address = (yield* accounts.me(row.userId as UserId)).account.address as Address
                const portfolio = valueHoldings(yield* balances.of(address), prices, now)
                const rule = row.trigger
                const target = rule.type === "drift" && row.agentId !== null
                  ? yield* agentStore.tradingState(row.agentId).pipe(
                    Effect.map(({ session }) =>
                      session === undefined ? undefined : configOf(session.spec.policies, rebalance)
                    )
                  )
                  : undefined

                const fire = yield* automations.advance(row.id, (state): Step =>
                  rule.type === "portfolio" ?
                    stepPortfolioLevel(rule.config, state, portfolio, at) :
                    rule.type === "drift" && target !== undefined ?
                    stepDrift(target, state, portfolio, at) :
                    { state, fire: null })
                if (fire === null) return
                fired++

                const trigger: TriggerData = {
                  summary: row.trigger.type === "drift"
                    ? "Your mix drifted from its target."
                    : "Your portfolio crossed its level.",
                  symbol: null,
                  price: null,
                  newsItemId: null
                }
                yield* FireAutomation.execute({ automationId: row.id, windowKey: fire, trigger }, {
                  discard: true
                })
                  .pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine))
              }).pipe(
                Effect.catchCause((cause) =>
                  Effect.logWarning(`Automation ${row.id}: its portfolio couldn't be read`, cause)
                )
              )
          )
          // A minute that fired nothing leaves no trace (`BluechipTracer` drops it).
          if (fired === 0) yield* Effect.annotateCurrentSpan("bluechip.idle", true)
        }
      )

      return PortfolioWatcher.of({ check })
    })
  )

  /** Every minute, on one runner of the cluster. */
  static readonly watch = Singleton.make(
    "automations.portfolios",
    Effect.gen(function*() {
      const watcher = yield* PortfolioWatcher
      yield* watcher.check().pipe(
        Effect.catchCause((cause) => Effect.logWarning("Portfolio watcher failed", cause)),
        Effect.repeat(Schedule.spaced("1 minute"))
      )
    })
  )
}
