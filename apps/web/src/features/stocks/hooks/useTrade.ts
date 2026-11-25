import type { RequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Shares, Usdc } from "@bluechip/domain/market/Units"
import type { Trade } from "@bluechip/domain/trading/Trade"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { liveTradesAtom } from "../../../lib/api/events.ts"
import { tradeProblem } from "../../../lib/tradeProblem.ts"
import { confirmTradeAtom, prepareTradeAtom } from "../atoms/trading.ts"

export type TradeFlow =
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "signing" }
  | { readonly status: "sent"; readonly trade: Trade }
  | { readonly status: "failed"; readonly message: string }

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
