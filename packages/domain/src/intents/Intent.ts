/**
 * An intent: one trade someone wants to make, on its way through bluechip's one pipeline. You, an agent's automation,
 * the assistant, a chat platform or an MCP client create one; it is decided by the agent's onchain policies (or by
 * your Face ID), executed once, and recorded with why.
 *
 * @since 0.0.0
 */
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { AgentId, IntentId, SigningRequestId, TradeId } from "../Ids.ts"
import { Quote, StockSymbol } from "../market/Market.ts"
import { Shares, Usdc } from "../market/Units.ts"
import { PolicyId } from "../policies/AgentSpec.ts"
import { TradeWarning } from "../trading/Trade.ts"
import { CeremonyOptions } from "../WebAuthn.ts"

/**
 * Who asked for it.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const IntentSource = Schema.Literals(["owner", "assistant", "automation", "channel", "mcp"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type IntentSource = typeof IntentSource.Type

/**
 * Who signs it: the agent's session key, inside its policies, or your passkey.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Executor = Schema.Literals(["agent", "owner"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Executor = typeof Executor.Type

/**
 * The trade: a stock, buy or sell, and how much (USDC to spend on a buy, shares to sell). One intent is one swap; an
 * action over several stocks makes several intents.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Leg = Schema.Struct({
  symbol: StockSymbol,
  side: Schema.Literals(["buy", "sell"]),
  amount: Schema.Union([Schema.Struct({ usdc: Usdc }), Schema.Struct({ shares: Shares })])
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Leg = typeof Leg.Type

/**
 * Why an intent waits instead of going ahead: prices paused (and the agent doesn't trade on them) or too old, no ETH
 * for gas, gas costing more right now than the agent's daily gas budget allows (`gasPrice`) or that budget spent for
 * today (`gasSpent`), the last minute of a UTC day (bundlers refuse an operation whose daily limits roll over), or
 * Base not answering.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const WaitReason = Schema.Literals([
  "pricesPaused",
  "pricesStale",
  "noGas",
  "gasPrice",
  "gasSpent",
  "dayEnding",
  "unavailable"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type WaitReason = typeof WaitReason.Type

/**
 * What the pipeline decided: the agent may send it (with the gas the simulation needs), it is bigger than the agent's
 * largest trade (your Face ID), it asks you first (an automation that asks, or one proposing your own trade: your
 * Face ID), a policy refused it, or it has to wait.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Decision = Schema.TaggedUnion({
  Passes: { callGasLimit: Schema.BigInt },
  OverLargestTrade: { maxPerTrade: Usdc },
  Ask: {},
  Refused: {
    policy: PolicyId,
    error: Schema.NullOr(Schema.String),
    stock: Schema.NullOr(Schema.String),
    message: Schema.String
  },
  Wait: { reason: WaitReason, until: Schema.DateTimeUtc }
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Decision = typeof Decision.Type

/**
 * Where an intent is. `proposed` → `deciding` → `sending` → `confirming` → `filled` or `failed`; or `needsApproval`
 * (then `awaitingSignature` once you approve), `blocked` by a policy, `waiting` to be decided again; your own trades
 * start at `awaitingSignature`. `declined`, `expired` and `cancelled` end it without sending.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const IntentStatus = Schema.Literals([
  "proposed",
  "deciding",
  "waiting",
  "needsApproval",
  "awaitingSignature",
  "sending",
  "confirming",
  "filled",
  "failed",
  "blocked",
  "declined",
  "expired",
  "cancelled"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type IntentStatus = typeof IntentStatus.Type

/**
 * What happens to an intent.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type IntentEvent =
  | { readonly _tag: "Decide" }
  | { readonly _tag: "Decided"; readonly decision: Decision }
  | { readonly _tag: "Prepared" }
  | { readonly _tag: "Signed" }
  | { readonly _tag: "Accepted" }
  | { readonly _tag: "Filled" }
  | { readonly _tag: "Failed" }
  | { readonly _tag: "Declined" }
  | { readonly _tag: "Expired" }
  | { readonly _tag: "Cancelled" }

/**
 * Whether nothing will happen to it any more.
 *
 * @stability unstable
 * @category predicates
 * @since 0.0.0
 */
export const isEnded = (status: IntentStatus): boolean =>
  (["filled", "failed", "blocked", "declined", "expired", "cancelled"] as ReadonlyArray<IntentStatus>).includes(status)

const step = (status: IntentStatus, from: ReadonlyArray<IntentStatus>, to: IntentStatus, what: string) =>
  from.includes(status) ? Result.succeed(to) : Result.fail(`a ${status} intent can't ${what}`)

/**
 * The next status after `event`, or why it can't happen.
 *
 * **Example** (An agent's trade within its policies)
 *
 * ```ts import.meta.vitest
 * import { transition } from "@bluechip/domain/intents/Intent"
 * import * as Result from "effect/Result"
 *
 * Result.getOrThrow(transition("proposed", { _tag: "Decide" })) // => "deciding"
 * Result.getOrThrow(transition("deciding", { _tag: "Decided", decision: { _tag: "Passes", callGasLimit: 1n } })) // => "sending"
 * ```
 *
 * @stability unstable
 * @category transitions
 * @since 0.0.0
 */
export const transition = (status: IntentStatus, event: IntentEvent): Result.Result<IntentStatus, string> => {
  switch (event._tag) {
    case "Decide":
      return step(status, ["proposed", "waiting"], "deciding", "be decided")
    case "Decided": {
      const decided: Readonly<Record<Decision["_tag"], IntentStatus>> = {
        Passes: "sending",
        OverLargestTrade: "needsApproval",
        Ask: "needsApproval",
        Refused: "blocked",
        Wait: "waiting"
      }
      return step(status, ["deciding"], decided[event.decision._tag], "take a decision")
    }
    case "Prepared":
      return step(status, ["proposed", "needsApproval"], "awaitingSignature", "wait for a signature")
    case "Signed":
      return step(status, ["awaitingSignature"], "sending", "be signed")
    case "Accepted":
      return step(status, ["sending"], "confirming", "be accepted")
    case "Filled":
      return step(status, ["confirming"], "filled", "fill")
    case "Failed":
      return step(status, ["sending", "confirming"], "failed", "fail")
    case "Declined":
      return step(status, ["needsApproval", "awaitingSignature"], "declined", "be declined")
    case "Expired":
      return step(status, ["waiting", "needsApproval", "awaitingSignature"], "expired", "expire")
    case "Cancelled":
      return step(status, ["proposed", "waiting", "needsApproval", "awaitingSignature"], "cancelled", "be cancelled")
  }
}

/**
 * An intent as the user sees it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Intent extends Schema.Class<Intent>("@bluechip/domain/intents/Intent/Intent")({
  id: IntentId,
  /** The agent it trades through; `null` for your own trades. */
  agentId: Schema.NullOr(AgentId),
  source: IntentSource,
  executor: Executor,
  leg: Leg,
  /** Why, in words. */
  reason: Schema.String,
  status: IntentStatus,
  decision: Schema.NullOr(Decision),
  tradeId: Schema.NullOr(TradeId),
  expiresAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
}) {}

/**
 * An intent prepared for your passkey: your own trade, or an agent's trade you approved. The WebAuthn request (its
 * challenge is the user operation's hash), the quote, and anything to look at twice.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class IntentRequest extends Schema.Class<IntentRequest>("@bluechip/domain/intents/Intent/IntentRequest")({
  id: SigningRequestId,
  options: CeremonyOptions,
  intent: Intent,
  quote: Quote,
  warnings: Schema.Array(TradeWarning),
  /** Whether this also deploys the account (its first transaction). */
  deploysAccount: Schema.Boolean,
  expiresAt: Schema.DateTimeUtc
}) {}
