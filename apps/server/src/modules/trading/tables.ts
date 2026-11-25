import { index, integer, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId, units } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"
import { intents } from "../intents/tables.ts"

/**
 * Trades sent from the account, by you or by an agent's key: quoted amounts until filled, then exactly what moved
 * (from the transaction's logs), with the Chainlink price it was checked against, and the intent it carried out.
 */
export const trades = pgTable("trades", {
  id: typeId("trade")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  intentId: typeId("intent")("intent_id").references(() => intents.id, { onDelete: "set null" }),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "set null" }),
  source: text("source", { enum: ["owner", "agent", "approval"] }).notNull().default("owner"),
  symbol: text("symbol").notNull(),
  side: text("side", { enum: ["buy", "sell"] }).notNull(),
  status: text("status", { enum: ["sending", "confirming", "filled", "failed"] }).notNull(),
  usdc: units("usdc").notNull(),
  shares: units("shares").notNull(),
  price: units("price").notNull(),
  reference: units("reference").notNull(),
  referenceStatus: text("reference_status", { enum: ["live", "paused", "stale"] }).notNull(),
  gapBps: integer("gap_bps").notNull(),
  userOpHash: text("user_op_hash"),
  txHash: text("tx_hash"),
  createdAt: dateTimeUtc("created_at").notNull(),
  settledAt: dateTimeUtc("settled_at")
}, (table) => [index("trades_user_created_at_idx").on(table.userId, table.createdAt)])
