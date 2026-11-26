import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"

/** How far a rebalancing agent's account was from its target mix, each hour, with the trigger it rebalances at. */
export const driftHistory = pgTable("drift_history", {
  agentId: typeId("agent")("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  at: dateTimeUtc("at").notNull(),
  driftBps: integer("drift_bps").notNull(),
  triggerBps: integer("trigger_bps").notNull()
}, (table) => [primaryKey({ columns: [table.agentId, table.at] })])
