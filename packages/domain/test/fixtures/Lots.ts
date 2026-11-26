// Ledger entries for the FIFO replay: buys that open lots and sales that close them.
import type { LotEntry } from "@bluechip/domain/ledger/Lots"
import { Shares, Usdc } from "@bluechip/domain/market/Units"

/** A buy of `shares` for `cost` at `at`, by `agentId` (`null`: you). */
export const opened = (
  source: string,
  shares: bigint,
  cost: bigint,
  at: number,
  agentId: string | null = null
): LotEntry => ({
  _tag: "Open",
  source,
  agentId,
  shares: Shares.make(shares),
  cost: Usdc.make(cost),
  at,
  flagged: false
})

/** A sale of `shares` for `proceeds` at `at`, by `agentId` (`null`: you). */
export const closed = (
  source: string,
  shares: bigint,
  proceeds: bigint,
  at: number,
  agentId: string | null = null
): LotEntry => ({
  _tag: "Close",
  source,
  agentId,
  shares: Shares.make(shares),
  proceeds: Usdc.make(proceeds),
  at,
  flagged: false
})
