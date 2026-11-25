import { boolean, index, jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../columns.ts"
import { users } from "./accounts.ts"

/**
 * The user's agents: their limits (encoded `Limits`), a change on its way, and their Namera session: the session key's
 * address, its end, the grant once locked (`Grant.serialize`, server-only), and the owner operation in flight.
 */
export const agents = pgTable("agents", {
  id: typeId("agent")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  template: text("template", { enum: ["rebalancer", "stockPicker", "weeklyBuyer", "stopLossGuard"] }).notNull(),
  status: text("status", { enum: ["draft", "locking", "active", "updating", "removing", "removed"] }).notNull(),
  paused: boolean("paused").notNull().default(false),
  limits: jsonb("limits").$type<unknown>().notNull(),
  pendingLimits: jsonb("pending_limits").$type<unknown>(),
  sessionKey: text("session_key").notNull(),
  lockedUntil: dateTimeUtc("locked_until"),
  grant: text("grant"),
  userOpHash: text("user_op_hash"),
  createdAt: dateTimeUtc("created_at").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
}, (table) => [index("agents_user_created_at_idx").on(table.userId, table.createdAt)])

/** Each agent's session key, encrypted (AES-256-GCM under `AGENT_KEY_ENCRYPTION_KEY`); only signing reads it. */
export const agentKeys = pgTable("agent_keys", {
  agentId: typeId("agent")("agent_id").primaryKey().references(() => agents.id, { onDelete: "cascade" }),
  ciphertext: text("ciphertext").notNull(),
  createdAt: dateTimeUtc("created_at").notNull()
})
