import { index, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId, units } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"

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
