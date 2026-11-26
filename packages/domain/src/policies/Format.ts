/**
 * How policies say amounts in sentences: whole dollars, prices per share, percentages from basis points, and lists of
 * names.
 *
 * @since 0.0.0
 */
const dollarFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

/**
 * USDC units as whole dollars: `$1,000`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatDollars = (amount: bigint | number): string =>
  dollarFormat.format(Number(BigInt(amount) / BigInt(1_000_000)))

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  trailingZeroDisplay: "stripIfInteger"
})

/**
 * A price per share (USD × 1e8, Chainlink's scale) in dollars, with cents when it has them: `$150`, `$152.04`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatPrice = (price: bigint): string => priceFormat.format(Number(price) / 1e8)

const shareFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 })

/**
 * A number of shares, to the 8 decimals a stock token has: `0.12345678`, `12`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatShares = (shares: number): string => shareFormat.format(shares)

/**
 * A number of shares with its noun, singular only for exactly one: `1 share`, `0.5 shares`; the same rule the web
 * app shows them by.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatShareCount = (shares: number): string => {
  const text = formatShares(shares)
  return `${text} ${text === "1" ? "share" : "shares"}`
}

/**
 * Basis points as a percentage: `2.5%`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const formatPercent = (bps: number): string => `${bps / 100}%`

/**
 * Names as people list them: `NVDA, AAPL and TSLA`, `NVDA, AAPL, TSLA and 2 more`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const listNames = (names: ReadonlyArray<string>): string => {
  if (names.length <= 1) return names[0] ?? "no stocks"
  if (names.length > 3) return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

/**
 * USDC units from whole dollars.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const dollars = (amount: number): bigint => BigInt(amount) * BigInt(1_000_000)
