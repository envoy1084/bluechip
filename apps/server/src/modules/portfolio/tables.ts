import { pgTable, primaryKey } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId, units } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"

/** Each user's portfolio value every 4 hours, kept for 30 days: the portfolio chart. */
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  at: dateTimeUtc("at").notNull(),
  /** USDC base units: cash plus stocks at market prices. */
  value: units("value").notNull(),
  cash: units("cash").notNull()
}, (table) => [primaryKey({ columns: [table.userId, table.at] })])
