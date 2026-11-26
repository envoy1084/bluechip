import { JournalRefs } from "@bluechip/domain/journal/Journal"
import { index, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, jsonbSchema, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"

/** Each agent's journal: what it did and why, in words bluechip writes from what happened, with what it points at. */
export const agentJournal = pgTable("agent_journal", {
  id: typeId("journal")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: typeId("agent")("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  at: dateTimeUtc("at").notNull(),
  kind: text("kind", { enum: ["intent", "automation", "judgment"] }).notNull(),
  entry: text("entry").notNull(),
  refs: jsonbSchema(JournalRefs)("refs").notNull()
}, (table) => [index("agent_journal_agent_at_idx").on(table.agentId, table.at)])
