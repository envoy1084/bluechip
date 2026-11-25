import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { Agents } from "./Agents.ts"

/** Agents whose session has ended, every 5 minutes: they stop trading and wait for you to renew them. */
export const ExpireAgentsCron = ClusterCron.make({
  name: "agents.expire",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: Agents.use((agents) => agents.expire()),
  skipIfOlderThan: Duration.minutes(5)
})
