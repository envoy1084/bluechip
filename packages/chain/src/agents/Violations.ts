/**
 * Why the chain refused an agent's operation, from its revert data: refused in validation by
 * `AerodromeTradePolicy` (the bundler drops it, nothing is paid), or in execution by `TradeGuard` (it reverts with
 * the rule it broke, the same rules bluechip's `evaluate` reports).
 *
 * @since 0.0.0
 */
import type { Rule } from "@bluechip/domain/agents/Evaluate"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { type Address, decodeErrorResult, type Hex, isAddressEqual, parseAbi } from "viem"
import { stocks } from "../Contracts.ts"
import { aerodromeTradePolicy, tradeGuard, tradeGuardAbi } from "./Deployed.ts"

/**
 * An operation the chain refused: in validation (which check failed isn't reported), or in execution with the rule
 * and the stock it is about.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Refusal =
  | { readonly layer: "validation" }
  | { readonly layer: "execution"; readonly rule: Rule; readonly symbol: StockSymbol | null }

// Smart Sessions refusing a session's policy, and SessionHook wrapping an execution policy's revert.
const sessionErrors = parseAbi([
  "error PolicyViolation(bytes32 permissionId, address policy)",
  "error ExecutionPolicyViolation(bytes32 permissionId, address policy, bytes reason)"
])

// TradeGuard's errors as bluechip's rules. A sequencer that's down leaves no price to trust; a stock that moved
// without cash moving the other way is value lost.
const RULES: Readonly<Record<string, Rule>> = {
  SequencerDown: "pricesStale",
  NotAllowedStock: "notAllowedStock",
  WrongDirection: "wrongDirection",
  NoCashSide: "unfairPrice",
  PricesStale: "pricesStale",
  PausedTradingOff: "pausedTradingOff",
  TooSmall: "tooSmall",
  OverTradeSize: "overTradeSize",
  UnfairPrice: "unfairPrice",
  OverStockCap: "overStockCap",
  UnderCashReserve: "underCashReserve",
  NotNeeded: "notNeeded",
  WrongWay: "wrongWay",
  Overshoots: "overshoots",
  NoProgress: "noProgress",
  LosesValue: "losesValue",
  OverSlippageBudget: "overSlippageBudget"
}

const symbolOf = (token: unknown): StockSymbol | null =>
  (stocks.find((stock) => typeof token === "string" && isAddressEqual(stock.token, token as Address))?.symbol ??
    null) as StockSymbol | null

const decode = <const A extends ReadonlyArray<unknown>>(abi: A, data: Hex) => {
  try {
    return decodeErrorResult({ abi: abi as never, data })
  } catch {
    return undefined
  }
}

/**
 * Why the chain refused an operation, from revert data; `undefined` when another contract reverted.
 *
 * @stability unstable
 * @category decoding
 * @since 0.0.0
 */
export const refusalOf = (data: Hex): Refusal | undefined => {
  const session = decode(sessionErrors, data)
  if (session === undefined) return undefined

  const [, policy, reason] = session.args as unknown as readonly [Hex, Address, Hex | undefined]
  if (session.errorName === "PolicyViolation") {
    return isAddressEqual(policy, aerodromeTradePolicy) ? { layer: "validation" } : undefined
  }
  if (!isAddressEqual(policy, tradeGuard) || reason === undefined) return undefined

  const guard = decode(tradeGuardAbi, reason)
  const rule = guard === undefined ? undefined : RULES[guard.errorName]
  if (guard === undefined || rule === undefined) return undefined
  return { layer: "execution", rule, symbol: symbolOf(guard.args?.[0]) }
}

const REVERT = /0x(?:3b577361|ee276506)[0-9a-fA-F]*/

/**
 * Why the chain refused an operation, from what the bundler or a receipt said: the first session refusal found in an
 * error's messages (and its causes'), or in a receipt's revert reason.
 *
 * @stability unstable
 * @category decoding
 * @since 0.0.0
 */
export const refusalFrom = (failure: unknown): Refusal | undefined => {
  for (let at: unknown = failure; at !== undefined && at !== null; at = (at as { cause?: unknown }).cause) {
    const text = typeof at === "string" ? at : String((at as { message?: unknown }).message ?? "")
    const found = REVERT.exec(text)?.[0]
    if (found !== undefined) return refusalOf(found as Hex)
    if (typeof at === "string") return undefined
  }
  return undefined
}
