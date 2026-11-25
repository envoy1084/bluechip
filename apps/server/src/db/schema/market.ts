import { index, pgTable, primaryKey, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, units } from "../columns.ts"

/** Each Chainlink answer a stock's feed gave (USD × 1e8 per share), at the time the feed updated. */
export const pricePoints = pgTable("price_points", {
  symbol: text("symbol").notNull(),
  at: dateTimeUtc("at").notNull(),
  price: units("price").notNull()
}, (table) => [primaryKey({ columns: [table.symbol, table.at] }), index("price_points_at_idx").on(table.at)])
