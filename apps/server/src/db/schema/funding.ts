import { boolean, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId, units } from "../columns.ts"
import { users } from "./accounts.ts"

/** Withdrawals the user signed, from prepared to confirmed or failed. */
export const transfers = pgTable("transfers", {
  id: typeId("transfer")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["deposit", "withdrawal"] }).notNull(),
  asset: text("asset").notNull(),
  amount: units("amount").notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "failed"] }).notNull(),
  /** The user operation's hash: known as soon as the bundler accepts it, before its transaction is. */
  userOpHash: text("user_op_hash"),
  txHash: text("tx_hash"),
  createdAt: dateTimeUtc("created_at").notNull()
}, (table) => [index("transfers_user_created_at_idx").on(table.userId, table.createdAt)])

/**
 * A withdrawal prepared for the user's passkey: the user operation as the bundler will get it (`userOperation`, RPC
 * encoding) and its hash, the WebAuthn challenge. Used once, within two minutes.
 */
export const signingRequests = pgTable("signing_requests", {
  id: typeId("signing")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** The client's request id: preparing the same withdrawal again returns this request. */
  requestId: text("request_id").notNull(),
  withdrawal: jsonb("withdrawal").$type<{ readonly amount: string; readonly to: string }>().notNull(),
  userOperation: jsonb("user_operation").$type<Record<string, unknown>>().notNull(),
  hash: text("hash").notNull(),
  deploysAccount: boolean("deploys_account").notNull(),
  createdAt: dateTimeUtc("created_at").notNull(),
  expiresAt: dateTimeUtc("expires_at").notNull(),
  usedAt: dateTimeUtc("used_at")
}, (table) => [uniqueIndex("signing_requests_user_request_idx").on(table.userId, table.requestId)])
