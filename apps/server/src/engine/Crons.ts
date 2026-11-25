// The server's scheduled jobs, run by the engine once per schedule across instances.
import { ChainClient } from "@bluechip/chain/ChainClient"
import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { jobRuns } from "../db/schema/jobRuns.ts"
import { IntentStore } from "../intents/IntentStore.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { PortfolioSnapshots } from "../portfolio/PortfolioSnapshots.ts"

/**
 * Every portfolio's value every 4 hours on the hour, at prices read afresh, for the 30-day chart; each run is recorded
 * in `job_runs`. A run more than an hour late is skipped.
 */
export const PortfolioSnapshotCron = ClusterCron.make({
  name: "portfolio.snapshot",
  cron: Cron.parseUnsafe("0 */4 * * *"),
  execute: Effect.gen(function*() {
    const db = yield* Database
    const chain = yield* ChainClient
    const market = yield* MarketPrices
    const snapshots = yield* PortfolioSnapshots
    const startedAt = yield* DateTime.now

    const prices = yield* market.read
    const { accounts } = yield* snapshots.record(prices)

    yield* db.insert(jobRuns).values({
      id: typeid("job").toString() as `job_${string}`,
      task: "portfolio.snapshot",
      status: "succeeded",
      startedAt,
      finishedAt: yield* DateTime.now,
      detail: { network: chain.network, accounts, prices: prices.size }
    }).pipe(Effect.orDie)
  }).pipe(Effect.withSpan("PortfolioSnapshotCron")),
  skipIfOlderThan: Duration.hours(1)
})

/** Approvals, signatures and waiting trades left open past their time, every 5 minutes. */
export const ExpireIntentsCron = ClusterCron.make({
  name: "intents.expire",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: IntentStore.use((store) => store.expire),
  skipIfOlderThan: Duration.minutes(5)
})

export const CronsLive = Layer.mergeAll(PortfolioSnapshotCron, ExpireIntentsCron)
