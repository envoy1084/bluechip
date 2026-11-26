import { driftOf } from "@bluechip/domain/automations/triggers/Drift"
import type { AgentId, UserId } from "@bluechip/domain/Ids"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { eq } from "drizzle-orm"
import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import type { Address } from "viem"
import { Database } from "../../platform/db/Database.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { AgentStore } from "../agents/AgentStore.ts"
import { agents } from "../agents/tables.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { valueHoldings } from "../portfolio/Valuation.ts"
import { Performance } from "./Performance.ts"

/**
 * Every hour, each active agent with a target mix: how far its account is from that mix, for its drift history. An
 * account that can't be read is left for the next hour. A run more than half an hour late is skipped.
 */
export const DriftCron = ClusterCron.make({
  name: "performance.drift",
  cron: Cron.parseUnsafe("10 * * * *"),
  execute: Effect.gen(function*() {
    const db = yield* Database
    const store = yield* AgentStore
    const accounts = yield* Accounts
    const balances = yield* AccountBalances
    const market = yield* MarketPrices
    const performance = yield* Performance

    const prices = yield* market.prices
    const now = yield* DateTime.now
    const active = yield* db.select({ id: agents.id, userId: agents.userId }).from(agents)
      .where(eq(agents.status, "active")).pipe(Effect.orDie)

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
      }).pipe(Effect.catchCause((cause) => Effect.logWarning(`Agent ${agent.id}: its drift couldn't be read`, cause))))
  }).pipe(Effect.withSpan("DriftCron")),
  skipIfOlderThan: Duration.minutes(30)
})
