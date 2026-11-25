// The devnet's Slipstream pools: their starting price from a Chainlink price, and how much liquidity to seed them
// with. USDC (6 decimals) sorts before every stock token (8 decimals, `0xb2…`), so USDC is token0 in every pool.

const Q96 = BigInt(2) ** BigInt(96)

/** The integer square root, rounded down. */
export const sqrt = (value: bigint): bigint => {
  if (value < BigInt(2)) return value

  let root = value
  let next = (root + BigInt(1)) / BigInt(2)
  while (next < root) {
    root = next
    next = (root + value / root) / BigInt(2)
  }
  return root
}

/**
 * A pool's `sqrtPriceX96` for a stock priced `price` (USD per token, 8 decimals): the pool's price is stock units per
 * USDC unit, `10^8 / (price / 10^8 × 10^6)` = `10^10 / price`.
 */
export const sqrtPriceX96Of = (price: bigint): bigint => sqrt((BigInt(10) ** BigInt(10) * Q96 * Q96) / price)

/** The tick a `sqrtPriceX96` sits in, rounded down. */
export const tickOf = (sqrtPriceX96: bigint): number => {
  const ratio = (Number(sqrtPriceX96) / Number(Q96)) ** 2
  return Math.floor(Math.log(ratio) / Math.log(1.0001))
}

/** A range of `width` ticks either side of `tick`, both ends on the pool's tick spacing. */
export const rangeAround = (tick: number, width: number, spacing: number) => ({
  lower: Math.floor((tick - width) / spacing) * spacing,
  upper: Math.ceil((tick + width) / spacing) * spacing
})

/**
 * The liquidity that puts about `usdc` (in USDC units) into a position from the current price up to `upperTick`:
 * `L = amount0 × √P × √Pb / (√Pb − √P)`, with prices as `sqrtPriceX96`. Sized with floating point, since only the
 * order of magnitude matters; the pool works out the exact amounts.
 */
export const liquidityFor = (usdc: bigint, sqrtPriceX96: bigint, upperTick: number): bigint => {
  const current = Number(sqrtPriceX96) / Number(Q96)
  const upper = Math.sqrt(1.0001 ** upperTick)
  return BigInt(Math.floor((Number(usdc) * current * upper) / (upper - current)))
}
