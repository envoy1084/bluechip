import { boolean, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../columns.ts"
import { users } from "./accounts.ts"

/**
 * An action prepared for the user's passkey (a withdrawal or a trade): the user operation as the bundler will get it
 * (`userOperation`, RPC encoding) and its hash, the WebAuthn challenge, with what it does (`payload`). Used once,
 * within two minutes.
 */
export const signingRequests = pgTable("signing_requests", {
  id: typeId("signing")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** The client's request id: preparing the same action again returns this request. */
  requestId: text("request_id").notNull(),
  kind: text("kind", { enum: ["withdrawal", "trade"] }).notNull(),
  payload: jsonb("payload").$type<Record<string, string>>().notNull(),
  userOperation: jsonb("user_operation").$type<Record<string, unknown>>().notNull(),
  hash: text("hash").notNull(),
  deploysAccount: boolean("deploys_account").notNull(),
  createdAt: dateTimeUtc("created_at").notNull(),
  expiresAt: dateTimeUtc("expires_at").notNull(),
  usedAt: dateTimeUtc("used_at")
}, (table) => [uniqueIndex("signing_requests_user_request_idx").on(table.userId, table.requestId)])
