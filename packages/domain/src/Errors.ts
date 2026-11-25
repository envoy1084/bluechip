/**
 * The errors every endpoint may return. Each carries its HTTP status, so the server encodes it and the typed client
 * decodes it back into the same class.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { LimitProblem } from "./agents/Rules.ts"

/**
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class Unauthenticated extends Schema.TaggedError<Unauthenticated>("@bluechip/domain/Errors/Unauthenticated")(
  "Unauthenticated",
  {},
  { httpApiStatus: 401 }
) {}

/**
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class Forbidden extends Schema.TaggedError<Forbidden>("@bluechip/domain/Errors/Forbidden")(
  "Forbidden",
  {},
  { httpApiStatus: 403 }
) {}

/**
 * A passkey signature did not verify: a wrong or unknown passkey, a used or expired challenge, a counter that went
 * backwards, or a ceremony the user cancelled.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class SignatureRejected
  extends Schema.TaggedError<SignatureRejected>("@bluechip/domain/Errors/SignatureRejected")(
    "SignatureRejected",
    { reason: Schema.Literals(["unknownPasskey", "challenge", "invalid", "counter"]) },
    { httpApiStatus: 403 }
  )
{}

/**
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class NotFound extends Schema.TaggedError<NotFound>("@bluechip/domain/Errors/NotFound")(
  "NotFound",
  { resource: Schema.String, id: Schema.String },
  { httpApiStatus: 404 }
) {}

/**
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class InvalidRequest extends Schema.TaggedError<InvalidRequest>("@bluechip/domain/Errors/InvalidRequest")(
  "InvalidRequest",
  { field: Schema.String, problem: Schema.Literals(["missing", "outOfRange", "invalid", "notAllowed"]) },
  { httpApiStatus: 400 }
) {}

/**
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class Conflict extends Schema.TaggedError<Conflict>("@bluechip/domain/Errors/Conflict")(
  "Conflict",
  { reason: Schema.Literals(["requestIdReused", "staleUpdate", "agentBusy"]) },
  { httpApiStatus: 409 }
) {}

/**
 * The stock has no pool to trade in.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class NotTradable extends Schema.TaggedError<NotTradable>("@bluechip/domain/Errors/NotTradable")(
  "NotTradable",
  { symbol: Schema.String },
  { httpApiStatus: 422 }
) {}

/**
 * No quote right now: the amount is more than the pool can fill, or the price couldn't be read.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class QuoteUnavailable extends Schema.TaggedError<QuoteUnavailable>("@bluechip/domain/Errors/QuoteUnavailable")(
  "QuoteUnavailable",
  { symbol: Schema.String, reason: Schema.Literals(["tooLarge", "tooSmall", "noPrice", "poolError"]) },
  { httpApiStatus: 422 }
) {}

/**
 * Not enough cash for a withdrawal or a buy.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class InsufficientCash extends Schema.TaggedError<InsufficientCash>("@bluechip/domain/Errors/InsufficientCash")(
  "InsufficientCash",
  { available: Schema.BigInt },
  { httpApiStatus: 422 }
) {}

/**
 * Not enough shares of a stock for a sell.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class InsufficientShares
  extends Schema.TaggedError<InsufficientShares>("@bluechip/domain/Errors/InsufficientShares")(
    "InsufficientShares",
    { symbol: Schema.String, available: Schema.BigInt },
    { httpApiStatus: 422 }
  )
{}

/**
 * The fair-price check refused a trade: the pool's price is further from Chainlink's than the limit allows
 * (`gap`), or Chainlink's price missed its heartbeat, so there is nothing trustworthy to compare with (`stale`).
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class PriceCheckFailed extends Schema.TaggedError<PriceCheckFailed>("@bluechip/domain/Errors/PriceCheckFailed")(
  "PriceCheckFailed",
  { symbol: Schema.String, reason: Schema.Literals(["gap", "stale"]), gapBps: Schema.Int, limitBps: Schema.Int },
  { httpApiStatus: 422 }
) {}

/**
 * The client was built against another contract version; it should reload.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class ClientOutdated extends Schema.TaggedError<ClientOutdated>("@bluechip/domain/Errors/ClientOutdated")(
  "ClientOutdated",
  { serverVersion: Schema.Int },
  { httpApiStatus: 426 }
) {}

/**
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class RateLimited extends Schema.TaggedError<RateLimited>("@bluechip/domain/Errors/RateLimited")(
  "RateLimited",
  { retryAfterSeconds: Schema.Int },
  { httpApiStatus: 429 }
) {}

/**
 * An unexpected failure on the server. The request id finds its logs.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class Internal extends Schema.TaggedError<Internal>("@bluechip/domain/Errors/Internal")(
  "Internal",
  { requestId: Schema.String },
  { httpApiStatus: 500 }
) {}

/**
 * A dependency (the chain, quotes, the database, the model) is down; retrying later can succeed.
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class Unavailable extends Schema.TaggedError<Unavailable>("@bluechip/domain/Errors/Unavailable")(
  "Unavailable",
  {
    dependency: Schema.Literals(["chain", "quotes", "database", "model"]),
    retryAfterSeconds: Schema.NullOr(Schema.Int)
  },
  { httpApiStatus: 503 }
) {}

/**
 * Whether retrying the same request later can succeed.
 *
 * @stability unstable
 * @category predicates
 * @since 0.0.0
 */
export const isRetryable = (error: unknown): boolean => error instanceof Unavailable || error instanceof RateLimited

/**
 * An agent's limits break a rule: each problem names the limit and why (outside its range, or not allowed for the
 * template).
 *
 * @stability unstable
 * @category errors
 * @since 0.0.0
 */
export class InvalidLimits extends Schema.TaggedError<InvalidLimits>("@bluechip/domain/Errors/InvalidLimits")(
  "InvalidLimits",
  { problems: Schema.Array(LimitProblem) },
  { httpApiStatus: 422 }
) {}
