import type { AgentId } from "@bluechip/domain/Ids"
import type { Decision } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { useAtomSet } from "@effect/atom-react/Hooks"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import { useEffect, useState } from "react"
import { previewIntentAtom } from "../atoms/intents.ts"
import { intentProblem } from "./intentText.ts"

export type PreviewState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly decision: Decision }
  | { readonly status: "failed"; readonly message: string }

const DEBOUNCE_MS = 400

/**
 * What the agent's policies would decide for a trade (USDC to spend on a buy, shares to sell), asked once someone
 * pauses typing.
 */
export function useIntentPreview(
  agentId: AgentId,
  symbol: StockSymbol | null,
  side: "buy" | "sell",
  amount: bigint | null
): PreviewState {
  const preview = useAtomSet(previewIntentAtom, { mode: "promiseExit" })
  const [state, setState] = useState<PreviewState>({ status: "idle" })

  useEffect(() => {
    if (symbol === null || amount === null) {
      setState({ status: "idle" })
      return
    }

    setState({ status: "loading" })
    let current = true
    const debounce = setTimeout(async () => {
      const leg = {
        symbol,
        side,
        amount: side === "buy" ? { usdc: Usdc.make(amount) } : { shares: Shares.make(amount) }
      }
      const exit = await preview({ payload: { agentId, leg } })
      if (!current) return
      setState(
        Exit.isSuccess(exit) ?
          { status: "ready", decision: exit.value } :
          {
            status: "failed",
            message: intentProblem(Option.getOrUndefined(Cause.findErrorOption(exit.cause)), side)
          }
      )
    }, DEBOUNCE_MS)

    return () => {
      current = false
      clearTimeout(debounce)
    }
  }, [agentId, symbol, side, amount, preview])

  return state
}
