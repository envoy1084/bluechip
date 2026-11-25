import { jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core"
import { dateTimeUtc } from "../columns.ts"

/**
 * Results of money-moving requests by their client-generated request id, so a retried request returns the first
 * result instead of acting twice. `fingerprint` (a hash of the payload) catches a reused id with different input.
 */
export const idempotencyKeys = pgTable("idempotency_keys", {
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  requestId: text("request_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  response: jsonb("response"),
  createdAt: dateTimeUtc("created_at").notNull()
}, (table) => [primaryKey({ columns: [table.userId, table.endpoint, table.requestId] })])
