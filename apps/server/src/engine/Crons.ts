// The server's scheduled jobs, run by the engine once per schedule across instances.
import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Layer from "effect/Layer"
import { expireIntents } from "../intents/IntentStore.ts"
import { snapshotPortfolioValues } from "../jobs/PortfolioSnapshot.ts"

/** Every portfolio's value every 4 hours on the hour, for the 30-day chart; a run more than an hour late is skipped. */
export const PortfolioSnapshotCron = ClusterCron.make({
  name: "portfolio.snapshot",
  cron: Cron.parseUnsafe("0 */4 * * *"),
  execute: snapshotPortfolioValues,
  skipIfOlderThan: Duration.hours(1)
})

/** Approvals, signatures and waiting trades left open past their time, every 5 minutes. */
export const ExpireIntentsCron = ClusterCron.make({
  name: "intents.expire",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: expireIntents,
  skipIfOlderThan: Duration.minutes(5)
})

export const CronsLive = Layer.mergeAll(PortfolioSnapshotCron, ExpireIntentsCron)
