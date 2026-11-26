/**
 * Amounts in automations' sentences: dollars with cents only when they have some, and prices on Chainlink's scale.
 *
 * @since 0.0.0
 */
const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

/**
 * USDC units as dollars: `$50`, `$12.50`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatUsd = (usdc: bigint): string => usdFormat.format(Number(usdc) / 1_000_000)

/**
 * A price (USD × 1e8) as dollars: `$250`, `$152.04`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatPrice = (price: bigint): string => usdFormat.format(Number(price) / 100_000_000)

/**
 * Basis points as a percentage: `10%`, `2.5%`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatBps = (bps: number): string => `${bps / 100}%`
