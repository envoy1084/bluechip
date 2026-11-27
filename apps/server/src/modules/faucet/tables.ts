import { index, pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId, units } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"

/** Test USDC the faucet sent each account, against its daily allowance; a grant whose transaction failed is removed. */
export const faucetGrants = pgTable("faucet_grants", {
  id: typeId("grant")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  account: text("account").notNull(),
  amount: units("amount").notNull(),
  txHash: text("tx_hash"),
  createdAt: dateTimeUtc("created_at").notNull()
}, (table) => [index("faucet_grants_user_created_at_idx").on(table.userId, table.createdAt)])
