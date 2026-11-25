import { InsufficientCash, InsufficientShares, PriceCheckFailed, QuoteUnavailable } from "@bluechip/domain/Errors"
import type { RequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Shares, Usdc } from "@bluechip/domain/market/Units"
import type { Trade } from "@bluechip/domain/trading/Trade"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { confirmTradeAtom, prepareTradeAtom } from "../atoms/trading.ts"
import { bpsPercent, shareCount, usdcDollars } from "../lib/amounts.ts"
import { liveTradesAtom } from "../lib/api/events.ts"

export type TradeFlow =
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "signing" }
  | { readonly status: "sent"; readonly trade: Trade }
  | { readonly status: "failed"; readonly message: string }

/** Why a trade didn't start, in words: nothing moved in any of these. */
export const tradeProblem = (error: unknown, side: "buy" | "sell"): string => {
  const nothing = side === "buy" ? "Nothing was bought." : "Nothing was sold."
  if (error instanceof InsufficientCash) return `You have ${formatMoney(usdcDollars(error.available))} in cash.`
  if (error instanceof InsufficientShares) return `You have ${shareCount(error.available)} shares to sell.`
  if (error instanceof QuoteUnavailable) return `We couldn't get a price from the pool. ${nothing}`
  if (error instanceof PriceCheckFailed) {
    return error.reason === "stale" ?
      `Chainlink's price isn't updating, so there's nothing to check the trade against. ${nothing}` :
      `The pool's price is ${bpsPercent(error.gapBps).toFixed(2)}% off Chainlink's, more than the ${
        bpsPercent(error.limitBps)
      }% allowed. ${nothing}`
  }
  return `Face ID was cancelled or the trade couldn't be sent. ${nothing}`
}

/**
 * Buying or selling with Face ID: the server prepares the trade (and checks its price), the passkey signs it, the
 * server sends it; its status then follows the live `TradeUpdated` events.
 */
export function useTrade(symbol: StockSymbol) {
  const prepare = useAtomSet(prepareTradeAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmTradeAtom, { mode: "promise" })
  const live = useAtomValue(liveTradesAtom)
  const [flow, setFlow] = useState<TradeFlow>({ status: "idle" })

  const start = async (side: "buy" | "sell", amount: { readonly usdc: Usdc } | { readonly shares: Shares }) => {
    setFlow({ status: "preparing" })
    try {
      const request = await prepare({ payload: { requestId: crypto.randomUUID() as RequestId, symbol, side, amount } })
      setFlow({ status: "signing" })
      const trade = await confirm({ id: request.id, options: request.options })
      setFlow({ status: "sent", trade })
    } catch (error) {
      setFlow({ status: "failed", message: tradeProblem(error, side) })
    }
  }

  const current = flow.status === "sent" ? { ...flow, trade: live.get(flow.trade.id) ?? flow.trade } : flow
  return { flow: current, start, reset: () => setFlow({ status: "idle" }) }
}
