import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../columns.ts"
import { users } from "./accounts.ts"
import { agents } from "./agents.ts"

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
 * why, what the pipeline decided, and how it ended. `dedupe_key` makes a retried request or a repeated automation
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
  dedupeKey: text("dedupe_key").notNull(),
  leg: jsonb("leg").$type<unknown>().notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: INTENT_STATUSES }).notNull(),
  decision: jsonb("decision").$type<unknown>(),
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
  index("intents_status_idx").on(table.status)
])

/** Who did what to what, and when. */
export const auditEvents = pgTable("audit_events", {
  id: typeId("audit")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actor: text("actor", { enum: ["owner", "agent", "assistant", "automation", "system"] }).notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  data: jsonb("data").$type<unknown>().notNull(),
  at: dateTimeUtc("at").notNull()
}, (table) => [index("audit_events_user_at_idx").on(table.userId, table.at)])
