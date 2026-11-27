/**
 * The ABIs of Aerodrome's Slipstream (concentrated liquidity) that bluechip calls: the factory, its swap router, its
 * quoter and a pool. Each network's addresses are in its `Deployment` (`exchange`); paper's exchange has the same ABIs.
 *
 * @since 0.0.0
 */
import { parseAbi } from "viem"

/**
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address)"
])

/**
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const metaquoterAbi = parseAbi([
  "function quoteExactInputSingleV3(address pool, address tokenIn, uint256 amountIn, uint160 sqrtPriceLimitX96) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed)"
])

/**
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const swapRouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; int24 tickSpacing; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)"
])

/**
 * A Slipstream pool's own reads: `fee()` is the share of what goes in that it keeps, in millionths (pips).
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const poolAbi = parseAbi(["function fee() view returns (uint24)"])
