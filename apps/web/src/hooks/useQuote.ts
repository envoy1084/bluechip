import { NotFound, NotTradable, QuoteUnavailable } from "@bluechip/domain/Errors"
import type { Quote, StockSymbol } from "@bluechip/domain/market/Market"
import type { Shares, Usdc } from "@bluechip/domain/market/Units"
import { useAtomSet } from "@effect/atom-react/Hooks"
import * as Cause from "effect/Cause"
import * as DateTime from "effect/DateTime"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import { useEffect, useState } from "react"
import { quoteAtom } from "../atoms/market.ts"

export type QuoteSide = "buy" | "sell"

export type QuoteState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly quote: Quote }
  | { readonly status: "failed"; readonly message: string }

const DEBOUNCE_MS = 400

const QUOTE_UNAVAILABLE: Readonly<Record<QuoteUnavailable["reason"], string>> = {
  tooLarge: "That's more than the pool can fill right now. Try a smaller amount.",
  tooSmall: "That amount is too small to trade. Try a little more.",
  belowMinimum: "The smallest trade is $1.",
  noPrice: "We can't read this stock's price right now. Try again in a moment.",
  poolError: "The trading pool didn't answer. Try again in a moment."
}

const failureMessage = (error: unknown): string => {
  if (error instanceof NotTradable) return "This stock can't be traded yet."
  if (error instanceof QuoteUnavailable) return QUOTE_UNAVAILABLE[error.reason]
  if (error instanceof NotFound) return "We couldn't find that stock."
  return "We couldn't get a quote. Check your connection and try again."
}

/**
 * Quotes what a trade would do for an amount (USDC to spend, or shares to sell), once someone pauses typing. A quote is only good for a few
 * seconds, so a shown one is requested again when it expires.
 */
export function useQuote(symbol: StockSymbol, side: QuoteSide, amount: Usdc | Shares | null): QuoteState {
  const requestQuote = useAtomSet(quoteAtom, { mode: "promiseExit" })
  const [state, setState] = useState<QuoteState>({ status: "idle" })
  const [renewals, setRenewals] = useState(0)
  const isBuy = side === "buy"
  const usdc = isBuy && amount !== null && amount > BigInt(0) ? amount as Usdc : null
  const shares = !isBuy && amount !== null && amount > BigInt(0) ? amount as Shares : null
  const hasAmount = usdc !== null || shares !== null

  // Anything that changes the question makes the shown answer wrong straight away.
  useEffect(() => {
    setState(hasAmount ? { status: "loading" } : { status: "idle" })
  }, [symbol, side, usdc, shares, hasAmount])

  useEffect(() => {
    if (usdc === null && shares === null) return
    let current = true
    let expiry: ReturnType<typeof setTimeout> | undefined
    const debounce = setTimeout(async () => {
      const amount = usdc === null ? { shares: shares! } : { usdc }
      const exit = await requestQuote({ payload: { symbol, side, amount } })
      if (!current) return
      if (Exit.isSuccess(exit)) {
        setState({ status: "ready", quote: exit.value })
        const lifetime = DateTime.toEpochMillis(exit.value.expiresAt) - Date.now()
        expiry = setTimeout(() => setRenewals((count) => count + 1), Math.max(lifetime, DEBOUNCE_MS))
        return
      }
      setState({ status: "failed", message: failureMessage(Option.getOrUndefined(Cause.findErrorOption(exit.cause))) })
    }, DEBOUNCE_MS)
    return () => {
      current = false
      clearTimeout(debounce)
      clearTimeout(expiry)
    }
  }, [requestQuote, symbol, side, usdc, shares, renewals])

  return state
}
