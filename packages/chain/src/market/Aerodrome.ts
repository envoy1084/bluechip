/**
 * Aerodrome's Slipstream (concentrated liquidity) deployment that holds the stock pools: the MetaDEX factory, its
 * swap router and its quoter. Source: Dromos Labs' deployment file
 * (https://github.com/dromos-labs/metadex-slipstream-public, `deployment-addresses/cl-base.json`), checked on a Base
 * fork on 2026-11-25 (the router's `factory()` is this factory, and the stock pools are its pools).
 *
 * @since 0.0.0
 */
import { type Address, parseAbi } from "viem"

/**
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const factory: Address = "0x9CB220581b91b0C83223012FE69688b92aD07a76"

/**
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const swapRouter: Address = "0x9Ee35Bf1bd69a03c6F0393582030fCe8Bb93D418"

/**
 * Quotes a swap in a given pool by simulating it (call it with `eth_call`; it is not a `view` function).
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const metaquoter: Address = "0x1dDfeC5058180C207F55BB77D95AcDd0d8227868"

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
