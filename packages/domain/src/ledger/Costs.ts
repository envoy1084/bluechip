/**
 * What a trade cost beyond the stock itself: the pool's fee and slippage, both in USDC, from what the trade recorded
 * (the fill, and Chainlink's price it was checked against). Gas is paid in ETH and kept apart.
 *
 * @since 0.0.0
 */
import { type Price, type Shares, Usdc, valueOf } from "../market/Units.ts"

const PIPS = BigInt(1_000_000)

/**
 * The pool's fee on a trade, in USDC, rounded down: Aerodrome's pools take `feePips` millionths of what goes in.
 * A buy puts USDC in, so the fee is that part of it; a sale puts shares in, so the fee is the shares' part valued at
 * what the rest fetched.
 *
 * **Example** (A $100 buy in a 0.05% pool)
 *
 * ```ts import.meta.vitest
 * import { poolFee } from "@bluechip/domain/ledger/Costs"
 * import { Usdc } from "@bluechip/domain/market/Units"
 *
 * poolFee("buy", Usdc.make(100_000_000n), 500) // => 50_000n
 * ```
 *
 * @stability unstable
 * @category costs
 * @since 0.0.0
 */
export const poolFee = (side: "buy" | "sell", usdc: Usdc, feePips: number): Usdc => {
  const fee = BigInt(feePips)
  if (fee <= BigInt(0) || fee >= PIPS) return Usdc.make(BigInt(0))
  return Usdc.make(side === "buy" ? (usdc * fee) / PIPS : (usdc * fee) / (PIPS - fee))
}

/**
 * How much worse the fill was than Chainlink's price, in USDC, beyond the pool's fee: a buyer paying more than the
 * shares were worth at `reference`, a seller getting less. Negative when the fill was better than Chainlink.
 *
 * **Example** (A buy of $100 that got $99.80 of shares, $0.05 of it the fee)
 *
 * ```ts import.meta.vitest
 * import { slippage } from "@bluechip/domain/ledger/Costs"
 * import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
 *
 * slippage({
 *   side: "buy",
 *   usdc: Usdc.make(100_000_000n),
 *   shares: Shares.make(998_000_000n),
 *   reference: Price.make(1_000_000_000n),
 *   fee: Usdc.make(50_000n)
 * })
 * // => 150_000n
 * ```
 *
 * @stability unstable
 * @category costs
 * @since 0.0.0
 */
export const slippage = (trade: {
  readonly side: "buy" | "sell"
  readonly usdc: Usdc
  readonly shares: Shares
  readonly reference: Price
  readonly fee: Usdc
}): bigint => {
  const worth = valueOf(trade.shares, trade.reference)
  const gap = trade.side === "buy" ? trade.usdc - worth : worth - trade.usdc
  return gap - trade.fee
}
