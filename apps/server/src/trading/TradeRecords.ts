import type { TradeId, TxHash } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { Trade } from "@bluechip/domain/trading/Trade"
import type { trades } from "../db/schema/trading.ts"

export type TradeRow = typeof trades.$inferSelect

export const toTrade = (row: TradeRow) =>
  new Trade({
    id: row.id as TradeId,
    symbol: row.symbol as StockSymbol,
    side: row.side,
    status: row.status,
    usdc: Usdc.make(row.usdc),
    shares: Shares.make(row.shares),
    price: Price.make(row.price),
    reference: Price.make(row.reference),
    referenceStatus: row.referenceStatus,
    gapBps: row.gapBps,
    txHash: row.txHash as TxHash | null,
    createdAt: row.createdAt,
    settledAt: row.settledAt
  })
