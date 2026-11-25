import { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { index, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, jsonbSchema, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"

/** Sets of policies users saved to start agents from. */
export const agentTemplates = pgTable("agent_templates", {
  id: typeId("template")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  basedOn: text("based_on"),
  spec: jsonbSchema(AgentSpec)("spec").notNull(),
  createdAt: dateTimeUtc("created_at").notNull()
}, (table) => [index("agent_templates_user_created_at_idx").on(table.userId, table.createdAt)])
