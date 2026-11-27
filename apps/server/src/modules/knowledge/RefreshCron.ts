import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { Knowledge } from "./Knowledge.ts"

/** The knowledge, every day at 04:00 UTC: help articles and stock facts brought in line, and anything unembedded. */
export const KnowledgeRefreshCron = measuredCron({
  name: "knowledge.refresh",
  cron: Cron.parseUnsafe("0 4 * * *"),
  execute: Effect.asVoid(Knowledge.use((knowledge) => knowledge.refresh)),
  skipIfOlderThan: Duration.hours(1)
})
