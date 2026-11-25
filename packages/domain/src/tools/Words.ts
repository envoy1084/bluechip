/**
 * Amounts in words for the model: what a tool returns is typed data for the app, and these sentences are what the
 * model reads in its place, so it never has to convert micro-dollars or 8-decimal prices.
 *
 * @since 0.0.0
 */
import * as Prompt from "effect/ai/Prompt"

const centsFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const sharesFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })

/**
 * USDC base units (6 decimals) as dollars and cents: `$1,234.56`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const usd = (micros: bigint): string => centsFormat.format(Number(micros) / 1_000_000)

/**
 * A price (8 decimals) as dollars and cents.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const price = (value: bigint): string => centsFormat.format(Number(value) / 100_000_000)

/**
 * Shares (8 decimals), to 4 places.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const shares = (value: bigint): string => sharesFormat.format(Number(value) / 100_000_000)

/**
 * Basis points as a signed percent: `+1.25%`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const change = (bps: number): string => `${bps >= 0 ? "+" : ""}${(bps / 100).toFixed(2)}%`

/**
 * One text part for `toModelOutput`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const say = (lines: ReadonlyArray<string> | string): ReadonlyArray<Prompt.ToolModelOutputPart> => [
  Prompt.textPart({ text: typeof lines === "string" ? lines : lines.join("\n") })
]
