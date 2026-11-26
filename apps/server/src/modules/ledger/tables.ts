import { boolean, date, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId, units } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"
import { trades } from "../trading/tables.ts"

/**
 * What changed a balance outside bluechip's trades and withdrawals, found by reconciliation: an account's opening
 * balance, a stock transferred in or out (valued at the market price), or a difference nothing explains. Amounts are
 * signed base units; `value` is the USDC it was worth (USDC itself: the amount).
 */
export const ledgerAdjustments = pgTable("ledger_adjustments", {
  id: typeId("adjustment")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  asset: text("asset").notNull(),
  reason: text("reason", { enum: ["opening", "transferIn", "transferOut", "unexplained"] }).notNull(),
  amount: units("amount").notNull(),
  /** The market price it was valued at (stocks); `null` for USDC or a stock with no price then. */
  price: units("price"),
  value: units("value").notNull(),
  blockNumber: units("block_number").notNull(),
  at: dateTimeUtc("at").notNull()
}, (table) => [index("ledger_adjustments_user_asset_idx").on(table.userId, table.asset)])

/**
 * Lots: the shares of one stock bought together (by a trade, or arriving outside bluechip), what they cost, and how
 * much of both is still held. Rebuilt from fills and adjustments (FIFO) whenever either changes.
 */
export const lots = pgTable("lots", {
  id: typeId("lot")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  /** The agent that bought it; `null` for your own trades and outside transfers. */
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "set null" }),
  tradeId: typeId("trade")("trade_id").references(() => trades.id, { onDelete: "cascade" }),
  adjustmentId: typeId("adjustment")("adjustment_id").references(() => ledgerAdjustments.id, { onDelete: "cascade" }),
  shares: units("shares").notNull(),
  cost: units("cost").notNull(),
  remaining: units("remaining").notNull(),
  remainingCost: units("remaining_cost").notNull(),
  openedAt: dateTimeUtc("opened_at").notNull(),
  closedAt: dateTimeUtc("closed_at"),
  /** Not bought through bluechip: its cost is the market price when it was found. */
  flagged: boolean("flagged").notNull()
}, (table) => [index("lots_user_symbol_idx").on(table.userId, table.symbol)])

/** What each sale (or transfer out) took from each lot, and the profit or loss that realised. */
export const lotClosings = pgTable("lot_closings", {
  id: typeId("closing")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  /** `null` for shares sold that no lot held. */
  lotId: typeId("lot")("lot_id").references(() => lots.id, { onDelete: "cascade" }),
  tradeId: typeId("trade")("trade_id").references(() => trades.id, { onDelete: "cascade" }),
  adjustmentId: typeId("adjustment")("adjustment_id").references(() => ledgerAdjustments.id, { onDelete: "cascade" }),
  /** The agent that sold. */
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "set null" }),
  shares: units("shares").notNull(),
  cost: units("cost").notNull(),
  proceeds: units("proceeds").notNull(),
  realised: units("realised").notNull(),
  closedAt: dateTimeUtc("closed_at").notNull(),
  flagged: boolean("flagged").notNull()
}, (table) => [index("lot_closings_user_closed_at_idx").on(table.userId, table.closedAt)])

/**
 * Each UTC day's profit and costs per stock and agent (`null`: your own trades): realised, fees, slippage (USDC base
 * units, signed) and gas (wei) from that day's fills and sales; unrealised measured each hour (`null` until then).
 */
export const pnlDaily = pgTable("pnl_daily", {
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day", { mode: "string" }).notNull(),
  symbol: text("symbol").notNull(),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  realised: units("realised").notNull(),
  unrealised: units("unrealised"),
  fees: units("fees").notNull(),
  slippage: units("slippage").notNull(),
  gasWei: units("gas_wei").notNull(),
  trades: integer("trades").notNull()
}, (table) => [
  unique("pnl_daily_user_day_symbol_agent_key").on(table.userId, table.day, table.symbol, table.agentId)
    .nullsNotDistinct()
])
