import { Decision, Leg } from "@bluechip/domain/intents/Intent"
import { boolean, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { dateTimeUtc, jsonbSchema, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"

const INTENT_STATUSES = [
  "proposed",
  "deciding",
  "waiting",
  "needsApproval",
  "awaitingSignature",
  "sending",
  "confirming",
  "filled",
  "failed",
  "blocked",
  "declined",
  "expired",
  "cancelled"
] as const

/**
 * Every trade anyone wants to make, yours included: who asked (`source`), who signs (`executor`), the trade (`leg`),
 * why, the plan it's part of, whether it asks you first, what the pipeline decided, and how it ended. `dedupe_key` makes a retried request or a repeated automation
 * fire create one intent.
 */
export const intents = pgTable("intents", {
  id: typeId("intent")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  sessionId: typeId("agentsession")("session_id"),
  source: text("source", { enum: ["owner", "assistant", "automation", "channel", "mcp"] }).notNull(),
  sourceId: text("source_id"),
  executor: text("executor", { enum: ["agent", "owner"] }).notNull(),
  /** Waits for your approval whatever the agent's policies allow: an automation that asks you first. */
  ask: boolean("ask").notNull().default(false),
  dedupeKey: text("dedupe_key").notNull(),
  leg: jsonbSchema(Leg)("leg").notNull(),
  /** The plan of several trades it belongs to (an automation's run), and the operation of it that carries it. */
  batchId: text("batch_id"),
  wave: integer("wave"),
  reason: text("reason").notNull(),
  status: text("status", { enum: INTENT_STATUSES }).notNull(),
  decision: jsonbSchema(Decision)("decision"),
  signingRequestId: typeId("signing")("signing_request_id"),
  userOpHash: text("user_op_hash"),
  tradeId: typeId("trade")("trade_id"),
  retryAt: dateTimeUtc("retry_at"),
  expiresAt: dateTimeUtc("expires_at"),
  createdAt: dateTimeUtc("created_at").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
}, (table) => [
  uniqueIndex("intents_user_dedupe_key_idx").on(table.userId, table.dedupeKey),
  index("intents_user_created_at_idx").on(table.userId, table.createdAt),
  index("intents_agent_created_at_idx").on(table.agentId, table.createdAt),
  index("intents_status_idx").on(table.status),
  index("intents_batch_idx").on(table.batchId, table.wave)
])
