import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"

/** Who did what to what, and when. */
export const auditEvents = pgTable("audit_events", {
  id: typeId("audit")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actor: text("actor", { enum: ["owner", "agent", "assistant", "automation", "system"] }).notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  /** The agent it concerns: the one that acted, or the one acted on. */
  agentId: text("agent_id"),
  data: jsonb("data").$type<unknown>().notNull(),
  at: dateTimeUtc("at").notNull()
}, (table) => [
  index("audit_events_user_at_idx").on(table.userId, table.at),
  index("audit_events_user_agent_idx").on(table.userId, table.agentId)
])
