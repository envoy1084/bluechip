/**
 * Money and quantities as integers in their smallest units, never floats: USDC in 6-decimal units, stock tokens in
 * 8-decimal units, prices in USD × 1e8 per share (as Chainlink reports them), ratios in basis points.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

const nonNegative = Schema.isGreaterThanOrEqualToBigInt(BigInt(0))

/**
 * USDC in its smallest unit: 1 USDC = 1 000 000.
 *
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export const Usdc = Schema.BigInt.check(nonNegative).pipe(Schema.brand("Usdc"))

/**
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export type Usdc = typeof Usdc.Type

/**
 * A stock token amount in its smallest unit: 1 share-token = 100 000 000.
 *
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export const Shares = Schema.BigInt.check(nonNegative).pipe(Schema.brand("Shares"))

/**
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export type Shares = typeof Shares.Type

/**
 * USD per share-token × 1e8, the scale of Coinbase's Chainlink feeds (which already include the token's multiplier).
 *
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export const Price = Schema.BigInt.check(nonNegative).pipe(Schema.brand("Price"))

/**
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export type Price = typeof Price.Type

/**
 * A ratio in basis points: 100 = 1%. Signed, for gaps and changes.
 *
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export const Bps = Schema.Int.pipe(Schema.brand("Bps"))

/**
 * @stability unstable
 * @category units
 * @since 0.0.0
 */
export type Bps = typeof Bps.Type

// shares (1e8) × price (1e8) = value in 1e16; USDC has 1e6, so divide by 1e10.
const SHARE_PRICE_TO_USDC = BigInt(10) ** BigInt(10)

/**
 * What `shares` are worth at `price`, rounded down to the unit, so a value never overstates what selling would give.
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const valueOf = (shares: Shares, price: Price): Usdc => Usdc.make((shares * price) / SHARE_PRICE_TO_USDC)

/**
 * How many shares `usdc` buys at `price`, rounded down to the unit, so a purchase never promises more than it buys.
 * Zero when the price is zero.
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const sharesFor = (usdc: Usdc, price: Price): Shares =>
  Shares.make(price === BigInt(0) ? BigInt(0) : (usdc * SHARE_PRICE_TO_USDC) / price)

/**
 * The price paid per share in a trade of `usdc` for `shares`, rounded to the nearest unit.
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const priceOf = (usdc: Usdc, shares: Shares): Price =>
  Price.make(shares === BigInt(0) ? BigInt(0) : (usdc * SHARE_PRICE_TO_USDC + shares / BigInt(2)) / shares)

/**
 * How far `value` is from `reference`, in basis points (positive when above), rounded toward zero.
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const bpsBetween = (value: bigint, reference: bigint): Bps =>
  Bps.make(reference === BigInt(0) ? 0 : Number(((value - reference) * BigInt(10_000)) / reference))

/**
 * `amount` less `bps` basis points, rounded down: the least a trade may return within a slippage tolerance.
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const lessBps = <A extends bigint>(amount: A, bps: number): A =>
  ((amount * BigInt(10_000 - bps)) / BigInt(10_000)) as A
