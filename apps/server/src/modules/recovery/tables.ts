import { jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../../platform/db/columns.ts"
import { passkeys, users } from "../accounts/tables.ts"

/**
 * The account's recovery passkey and its guard: two Namera sessions locked in one owner operation (`user_op_hash`
 * while it, or the removal, is on its way). The guard's key, sealed like agents' keys, may only cancel a recovery.
 * One row is in force per user; a removed one stays as history.
 */
export const recoveryKeys = pgTable("recovery_keys", {
  id: typeId("recoverykey")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  passkeyId: typeId("passkey")("passkey_id").notNull().references(() => passkeys.id, { onDelete: "cascade" }),
  guardAddress: text("guard_address").notNull(),
  guardKey: text("guard_key").notNull(),
  status: text("status", { enum: ["draft", "locking", "active", "removing", "removed"] }).notNull(),
  userOpHash: text("user_op_hash"),
  createdAt: dateTimeUtc("created_at").notNull(),
  lockedAt: dateTimeUtc("locked_at"),
  removedAt: dateTimeUtc("removed_at")
})

/**
 * A recovery: the owner changes it asks for (`calls`: add the new passkey, remove the old ones), the step prepared for
 * the recovery passkey to sign (`user_operation`, its `hash` and when it expires), the operation on its way, and how
 * it went. `executable_at` is set from the chain once the request lands.
 */
export const recoveryRequests = pgTable("recovery_requests", {
  id: typeId("recovery")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recoveryKeyId: typeId("recoverykey")("recovery_key_id").notNull().references(() => recoveryKeys.id, {
    onDelete: "cascade"
  }),
  newPasskeyId: typeId("passkey")("new_passkey_id").notNull().references(() => passkeys.id, { onDelete: "cascade" }),
  calls: jsonb("calls").$type<ReadonlyArray<{ readonly to: string; readonly data: string }>>().notNull(),
  status: text("status", {
    enum: ["draft", "requesting", "waiting", "cancelled", "executing", "completed", "failed"]
  }).notNull(),
  signing: text("signing", { enum: ["request", "execute"] }),
  userOperation: jsonb("user_operation").$type<Record<string, unknown>>(),
  hash: text("hash"),
  signingExpiresAt: dateTimeUtc("signing_expires_at"),
  userOpHash: text("user_op_hash"),
  requestedAt: dateTimeUtc("requested_at").notNull(),
  executableAt: dateTimeUtc("executable_at"),
  cancelledAt: dateTimeUtc("cancelled_at"),
  cancelledFrom: text("cancelled_from", { enum: ["app", "telegram"] }),
  executedAt: dateTimeUtc("executed_at")
})
