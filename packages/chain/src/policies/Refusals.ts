/**
 * Why the chain refused an agent's operation, from its revert data, said as the policy that refused it: in validation
 * by `AerodromeTradePolicy` or one of Namera's limits (the bundler drops it, nothing is paid), or in execution by
 * `TradeGuard` (its own checks of what moved and the prices, or a rule it runs).
 *
 * @since 0.0.0
 */
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import * as GasPolicy from "@namera-ai/contracts/GasPolicy"
import * as RateLimitPolicy from "@namera-ai/contracts/RateLimitPolicy"
import { type Abi, type Address, decodeErrorResult, type Hex, isAddressEqual, parseAbi } from "viem"
import { stocks } from "../Contracts.ts"
import { aerodromeTradePolicy, tradeGuard, tradeGuardAbi } from "./Deployed.ts"
import { RULES } from "./Rules.ts"

/**
 * An operation a policy refused: the policy, the contract's error (`null` when validation doesn't say which check
 * failed), the stock it is about, and a sentence.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Refusal {
  readonly policy: PolicyId
  readonly error: string | null
  readonly stock: string | null
  readonly message: string
}

// Smart Sessions refusing a session's policy, and SessionHook wrapping an execution policy's revert.
const sessionErrors = parseAbi([
  "error PolicyViolation(bytes32 permissionId, address policy)",
  "error ExecutionPolicyViolation(bytes32 permissionId, address policy, bytes reason)"
])

const VALIDATION: ReadonlyArray<{ readonly address: Address; readonly policy: PolicyId; readonly message: string }> = [
  {
    address: aerodromeTradePolicy,
    policy: "trade",
    message: "Not a trade it may make: another stock, the other direction, or over its budget or largest buy."
  },
  { address: RateLimitPolicy.addressV1, policy: "tradesPerDay", message: "It has made all of today's trades." },
  { address: GasPolicy.addressV1, policy: "gasBudget", message: "It has used today's gas." }
]

// TradeGuard's own checks: what moved belongs to the trade policy, the prices to the fair-price policy.
const HOST: Readonly<Record<string, { readonly policy: PolicyId; readonly message: (stock: string) => string }>> = {
  SequencerDown: {
    policy: "fairPrice",
    message: () => "Base's sequencer was down recently, so prices can't be trusted yet."
  },
  NotAllowedStock: { policy: "trade", message: (stock) => `It may not trade ${stock}.` },
  WrongDirection: { policy: "trade", message: (stock) => `It may not trade ${stock} that way.` },
  NoCashSide: { policy: "trade", message: () => "A stock moved without cash moving the other way." },
  PricesStale: { policy: "fairPrice", message: (stock) => `Chainlink's price for ${stock} is too old.` },
  PausedTradingOff: { policy: "fairPrice", message: () => "It doesn't trade while prices are paused." }
}

const decode = (abi: Abi, data: Hex) => {
  try {
    return decodeErrorResult({ abi, data })
  } catch {
    return undefined
  }
}

const stockNamed = (value: unknown) =>
  stocks.find((stock) => typeof value === "string" && isAddressEqual(stock.token, value as Address))?.symbol ?? null

const executionRefusal = (reason: Hex): Refusal | undefined => {
  const host = decode(tradeGuardAbi, reason)
  if (host !== undefined && HOST[host.errorName] !== undefined) {
    const stock = stockNamed(host.args?.[0])
    const { message, policy } = HOST[host.errorName]!
    return { policy, error: host.errorName, stock, message: message(stock ?? "a stock") }
  }

  for (const rule of RULES) {
    const found = decode(rule.abi, reason)
    const message = found === undefined ? undefined : rule.errors[found.errorName]
    if (found === undefined || message === undefined) continue
    const stock = stockNamed(found.args?.[0])
    return { policy: rule.policy, error: found.errorName, stock, message: message(stock ?? "a stock") }
  }
  return undefined
}

/**
 * Why a policy refused an operation, from revert data; `undefined` when something else reverted.
 *
 * @stability unstable
 * @category decoding
 * @since 0.0.0
 */
export const refusalOf = (data: Hex): Refusal | undefined => {
  const session = decode(sessionErrors as Abi, data)
  if (session === undefined) return undefined

  const [, policy, reason] = session.args as unknown as readonly [Hex, Address, Hex | undefined]
  if (session.errorName === "PolicyViolation") {
    const refused = VALIDATION.find((candidate) => isAddressEqual(candidate.address, policy))
    return refused === undefined
      ? undefined
      : { policy: refused.policy, error: null, stock: null, message: refused.message }
  }
  if (!isAddressEqual(policy, tradeGuard) || reason === undefined) return undefined
  return executionRefusal(reason)
}

const REVERT = /0x(?:3b577361|ee276506)[0-9a-fA-F]*/

/**
 * Why a policy refused an operation, from what the bundler or a receipt said: the first session refusal found in an
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
