// Activity items as the API lists them: a $92.95 Apple buy and cash moving in and out.
import { ActivityItem } from "@bluechip/domain/activity/Activity"
import { Address, TradeId, TransferId, TxHash } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { Transfer } from "@bluechip/domain/portfolio/Transfer"
import { Trade } from "@bluechip/domain/trading/Trade"
import * as DateTime from "effect/DateTime"

export const ACCOUNT = Address.make("0x7a3F00000000000000000000000000000000B9d4")
export const WALLET = Address.make("0x000000000000000000000000000000000000dEaD")
const TX = TxHash.make(`0x${"ab".repeat(32)}`)

export const NAMES: ReadonlyMap<StockSymbol, string> = new Map<StockSymbol, string>([["AAPL", "Apple"]])

/** Your $92.95 Apple buy: 0.38841567 shares at $239.30, filled 0.12% better than Chainlink unless told otherwise. */
export const appleTrade = (trade: Partial<Pick<Trade, "side" | "status" | "usdc" | "agentId">> = {}) =>
  ActivityItem.cases.Trade.make({
    trade: new Trade({
      id: TradeId.make("trade_01jd8v4t5m6n7a8q9r0s1t2v3w"),
      agentId: null,
      symbol: "AAPL",
      side: "buy",
      status: "filled",
      usdc: Usdc.make(92_950_000n),
      shares: Shares.make(38_841_567n),
      price: Price.make(23_930_000_000n),
      reference: Price.make(23_960_000_000n),
      referenceStatus: "live",
      gapBps: -12,
      txHash: TX,
      createdAt: DateTime.makeUnsafe("2026-11-26T09:41:00Z"),
      settledAt: DateTime.makeUnsafe("2026-11-26T09:41:04Z"),
      ...trade
    })
  })

/** A cash transfer between your account and your wallet: $15.00 withdrawn, landed, unless told otherwise. */
export const cashTransfer = (transfer: Partial<Pick<Transfer, "kind" | "status" | "amount" | "asset">> = {}) => {
  const kind = transfer.kind ?? "withdrawal"
  return ActivityItem.cases.Withdrawal.make({
    transfer: new Transfer({
      id: TransferId.make("transfer_01jd8v4t5m6n7a8q9r0s1t2v3w"),
      kind,
      asset: "USDC",
      amount: 15_000_000n,
      from: kind === "deposit" ? WALLET : ACCOUNT,
      to: kind === "deposit" ? ACCOUNT : WALLET,
      status: "confirmed",
      txHash: TX,
      createdAt: DateTime.makeUnsafe("2026-11-26T10:00:00Z"),
      ...transfer
    })
  })
}
