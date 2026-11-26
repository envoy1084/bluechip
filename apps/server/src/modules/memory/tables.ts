import { doublePrecision, index, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"
import { messages } from "../assistant/tables.ts"

/**
 * What the assistant remembers about each user: the fact, where it came from and how sure it was, the message it was
 * learned from, and when the user confirmed it (unconfirmed memories never reach a prompt).
 */
export const memories = pgTable("memories", {
  id: typeId("memory")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["preference", "constraint", "goal", "fact"] }).notNull(),
  text: text("text").notNull(),
  source: text("source", { enum: ["said", "inferred"] }).notNull(),
  confidence: doublePrecision("confidence").notNull(),
  note: text("note"),
  messageId: typeId("message")("message_id").references(() => messages.id, { onDelete: "set null" }),
  confirmedAt: dateTimeUtc("confirmed_at"),
  createdAt: dateTimeUtc("created_at").notNull(),
  lastUsedAt: dateTimeUtc("last_used_at")
}, (table) => [index("memories_user_created_at_idx").on(table.userId, table.createdAt)])
