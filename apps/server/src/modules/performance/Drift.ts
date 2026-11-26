import { driftOf } from "@bluechip/domain/automations/triggers/Drift"
import type { AgentId, UserId } from "@bluechip/domain/Ids"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { and, eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Address } from "viem"
import { Database } from "../../platform/db/Database.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { AgentStore } from "../agents/AgentStore.ts"
import { agents } from "../agents/tables.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { valueHoldings } from "../portfolio/Valuation.ts"
import { Performance } from "./Performance.ts"

/** How far agents' accounts are from their target mixes, measured into their drift history. */
export class Drift extends Context.Service<Drift, {
  /**
   * Measures each active agent with a target mix (everyone's, or one user's) at market prices and records the point.
   * An account that can't be read is left for the next measure.
   */
  readonly measure: (options?: { readonly userId?: UserId | undefined }) => Effect.Effect<void>
}>()("@bluechip/server/Drift") {
  static readonly layer = Layer.effect(
    Drift,
    Effect.gen(function*() {
      const db = yield* Database
      const store = yield* AgentStore
      const accounts = yield* Accounts
      const balances = yield* AccountBalances
      const market = yield* MarketPrices
      const performance = yield* Performance

      const measure = Effect.fn("Drift.measure")(function*(options: { readonly userId?: UserId | undefined } = {}) {
        const prices = yield* market.prices
        const now = yield* DateTime.now
        const active = yield* db.select({ id: agents.id, userId: agents.userId }).from(agents).where(and(
          eq(agents.status, "active"),
          options.userId === undefined ? undefined : eq(agents.userId, options.userId as `user_${string}`)
        )).pipe(Effect.orDie)

        yield* Effect.forEach(active, (agent) =>
          Effect.gen(function*() {
            const { session } = yield* store.tradingState(agent.id)
            const config = session === undefined ? undefined : configOf(session.spec.policies, rebalance)
            if (config === undefined) return

            const address = (yield* accounts.me(agent.userId as UserId)).account.address as Address
            const portfolio = valueHoldings(yield* balances.of(address), prices, now)
            yield* performance.recordDrift({
              agentId: agent.id as AgentId,
              userId: agent.userId as UserId,
              driftBps: driftOf(portfolio, config),
              triggerBps: config.triggerBps
            })
          }).pipe(
            Effect.catchCause((cause) => Effect.logWarning(`Agent ${agent.id}: its drift couldn't be read`, cause))
          ))
      })

      return Drift.of({ measure })
    })
  )
}
