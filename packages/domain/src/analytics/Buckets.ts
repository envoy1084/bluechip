/**
 * Amounts in analytics: exact dollars go only on the server's money events; everywhere else an amount is one of a
 * few ranges, so the web and any breakdown never carry a person's exact balance or trade.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

/**
 * The ranges an amount in dollars falls in, smallest first.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const UsdBucket = Schema.Literals(["<$10", "$10–50", "$50–100", "$100–500", "$500–1k", "$1k–5k", "$5k+"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type UsdBucket = typeof UsdBucket.Type

/**
 * The ranges of what a person has put in, from their deposits (never their balance): a person property.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const FundedBucket = Schema.Literals(["<$100", "$100–1k", "$1k–10k", "$10k+"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type FundedBucket = typeof FundedBucket.Type

const USD_BOUNDS: ReadonlyArray<readonly [number, UsdBucket]> = [
  [10, "<$10"],
  [50, "$10–50"],
  [100, "$50–100"],
  [500, "$100–500"],
  [1_000, "$500–1k"],
  [5_000, "$1k–5k"]
]

const FUNDED_BOUNDS: ReadonlyArray<readonly [number, FundedBucket]> = [
  [100, "<$100"],
  [1_000, "$100–1k"],
  [10_000, "$1k–10k"]
]

/**
 * The range `usd` dollars fall in. Each range includes its lower bound: $10 is `$10–50`, $9.99 is `<$10`.
 *
 * @stability unstable
 * @category buckets
 * @since 0.0.0
 */
export const usdBucket = (usd: number): UsdBucket => USD_BOUNDS.find(([below]) => usd < below)?.[1] ?? "$5k+"

/**
 * The range `usd` dollars deposited in total fall in, each range including its lower bound.
 *
 * @stability unstable
 * @category buckets
 * @since 0.0.0
 */
export const fundedBucket = (usd: number): FundedBucket => FUNDED_BOUNDS.find(([below]) => usd < below)?.[1] ?? "$10k+"
