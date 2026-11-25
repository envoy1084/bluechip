import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../columns.ts"

/** One row per scheduled job run, so jobs can be checked from the database (and the dev page) without Trigger.dev. */
export const jobRuns = pgTable("job_runs", {
  id: typeId("job")("id").primaryKey(),
  task: text("task").notNull(),
  status: text("status", { enum: ["succeeded", "failed"] }).notNull(),
  startedAt: dateTimeUtc("started_at").notNull(),
  finishedAt: dateTimeUtc("finished_at").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull()
}, (table) => [index("job_runs_task_started_at_idx").on(table.task, table.startedAt)])
