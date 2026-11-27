import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { Agents } from "./Agents.ts"

/** Agents whose session has ended, every 5 minutes: they stop trading and wait for you to renew them. */
export const ExpireAgentsCron = measuredCron({
  name: "agents.expire",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: Agents.use((agents) => agents.expire()),
  skipIfOlderThan: Duration.minutes(5)
})
