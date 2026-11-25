import { stocks } from "@bluechip/chain/Contracts"
import { fillOf } from "@bluechip/chain/market/Swaps"
import { LiveEvent } from "@bluechip/domain/Events"
import type { UserId } from "@bluechip/domain/Ids"
import { bpsBetween, priceOf, type Shares, type Usdc } from "@bluechip/domain/market/Units"
import { transition } from "@bluechip/domain/trading/Trade"
import { eq } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import type { Hex, Log } from "viem"
import { Database } from "../db/Database.ts"
import { trades } from "../db/schema/trading.ts"
import { LiveEvents } from "../live/LiveEvents.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { toTrade, type TradeRow } from "./TradeRecords.ts"

/** A user operation's receipt, or `undefined` when it never came. */
export type Receipt = { readonly success: boolean; readonly txHash: Hex; readonly logs: ReadonlyArray<Log> } | undefined

/** What a fill moved, as the trade records it: exact USDC and shares, the price they make and its gap to Chainlink. */
const filled = (row: TradeRow, fill: { readonly amountIn: bigint; readonly amountOut: bigint }) => {
  const usdc = (row.side === "buy" ? fill.amountIn : fill.amountOut) as Usdc
  const shares = (row.side === "buy" ? fill.amountOut : fill.amountIn) as Shares
  const price = priceOf(usdc, shares)

  return {
    usdc,
    shares,
    price,
    // Paying above the reference is worse for a buyer; receiving below it is worse for a seller.
    gapBps: row.side === "buy" ? bpsBetween(price, row.reference) : bpsBetween(row.reference, price)
  }
}

/**
 * Records how a sent trade ended, from its receipt: filled with exactly what moved (read from the logs), or failed
 * (the money stays). Then refreshes the account's balances and tells its owner. Returns the trade as saved, or
 * `undefined` when it had already ended.
 */
export const settleTrade = Effect.fnUntraced(function*(row: TradeRow, account: Hex, receipt: Receipt) {
  const db = yield* Database
  const live = yield* LiveEvents
  const balances = yield* AccountBalances

  const stock = stocks.find((candidate) => candidate.symbol === row.symbol)!
  const fill = receipt?.success === true ? fillOf(receipt.logs, { stock, side: row.side }, account) : undefined
  const next = transition(row.status, { _tag: fill === undefined ? "Failed" : "Filled" })
  if (Result.isFailure(next)) {
    yield* Effect.logWarning(`Trade ${row.id}: ${next.failure}`)
    return undefined
  }

  const changes = {
    status: next.success,
    txHash: receipt?.txHash ?? null,
    settledAt: yield* DateTime.now,
    ...(fill === undefined ? {} : filled(row, fill))
  }
  const [updated] = yield* db.update(trades).set(changes).where(eq(trades.id, row.id)).returning().pipe(Effect.orDie)

  // Fresh balances before the events, so a client that refetches on them sees the new holdings.
  yield* balances.invalidate(account)
  yield* live.publish(LiveEvent.cases.TradeUpdated.make({ trade: toTrade(updated!) }), row.userId as UserId)
  yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), row.userId as UserId)
  return updated!
})
