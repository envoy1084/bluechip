/**
 * Buying and selling a stock against its Aerodrome pool, signed by the account's passkey (or, later, an agent's
 * session key), checked against Chainlink's price before signing.
 *
 * @since 0.0.0
 */
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { AgentId, SigningRequestId, TradeId, TxHash } from "../Ids.ts"
import { PriceStatus, Quote, StockSymbol } from "../market/Market.ts"
import { Price, Shares, Usdc } from "../market/Units.ts"
import { CeremonyOptions } from "../WebAuthn.ts"

/**
 * The smallest buy you can make: $1 of USDC. Smaller buys aren't quoted or sent.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MINIMUM_BUY: Usdc = Usdc.make(BigInt(1_000_000))

/**
 * Where a trade is: sent to the bundler, waiting for Base, done (`filled`) or not (`failed`, the money stays).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TradeStatus = Schema.Literals(["sending", "confirming", "filled", "failed"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradeStatus = typeof TradeStatus.Type

/**
 * What can happen to a trade: the bundler accepted it, Base included it (with what moved), or it failed.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradeEvent =
  | { readonly _tag: "Accepted" }
  | { readonly _tag: "Filled" }
  | { readonly _tag: "Failed" }

/**
 * The next status after `event`, or the reason it can't happen: a trade only moves forward, and once filled or
 * failed it never changes again.
 *
 * **Example** (Following a trade)
 *
 * ```ts import.meta.vitest
 * import { transition } from "@bluechip/domain/trading/Trade"
 * import * as Result from "effect/Result"
 *
 * Result.getOrThrow(transition("sending", { _tag: "Accepted" })) // => "confirming"
 * Result.isFailure(transition("filled", { _tag: "Failed" })) // => true
 * ```
 *
 * @stability unstable
 * @category transitions
 * @since 0.0.0
 */
export const transition = (status: TradeStatus, event: TradeEvent): Result.Result<TradeStatus, string> => {
  switch (event._tag) {
    case "Accepted":
      return status === "sending" ? Result.succeed("confirming") : Result.fail(`a ${status} trade can't be accepted`)
    case "Filled":
      return status === "confirming" ? Result.succeed("filled") : Result.fail(`a ${status} trade can't fill`)
    case "Failed":
      return status === "sending" || status === "confirming"
        ? Result.succeed("failed")
        : Result.fail(`a ${status} trade can't fail`)
  }
}

/**
 * Why a trade needs a second look before signing: prices are paused (weekend or holiday, so Chainlink's is the last
 * one before the pause), or the stock market and Chainlink are more than 1% apart.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TradeWarning = Schema.Literals(["pricesPaused", "marketApart"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradeWarning = typeof TradeWarning.Type

/**
 * A trade prepared for the user's passkey: the WebAuthn request (its challenge is the user operation's hash), the
 * quote it was built from, the least it may return, and anything to look at twice.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class TradeRequest extends Schema.Class<TradeRequest>("@bluechip/domain/trading/Trade/TradeRequest")({
  id: SigningRequestId,
  options: CeremonyOptions,
  quote: Quote,
  warnings: Schema.Array(TradeWarning),
  /** Whether this also deploys the account (its first transaction). */
  deploysAccount: Schema.Boolean,
  expiresAt: Schema.DateTimeUtc
}) {}

/**
 * A trade: what was asked for and, once filled, what actually moved (USDC and shares from the transaction's logs)
 * and at what price, against the Chainlink price it was checked with.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Trade extends Schema.Class<Trade>("@bluechip/domain/trading/Trade/Trade")({
  id: TradeId,
  /** The agent it was sent for (by its key, or by your Face ID approving it); `null` for your own. */
  agentId: Schema.NullOr(AgentId),
  symbol: StockSymbol,
  side: Schema.Literals(["buy", "sell"]),
  status: TradeStatus,
  /** USDC spent (buy) or received (sell): quoted until filled, then exact. */
  usdc: Usdc,
  /** Shares received (buy) or sold (sell): quoted until filled, then exact. */
  shares: Shares,
  price: Price,
  reference: Price,
  referenceStatus: PriceStatus,
  /** How much worse than Chainlink, in basis points (negative is better). */
  gapBps: Schema.Int,
  txHash: Schema.NullOr(TxHash),
  createdAt: Schema.DateTimeUtc,
  settledAt: Schema.NullOr(Schema.DateTimeUtc)
}) {}
