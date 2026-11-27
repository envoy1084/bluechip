/**
 * The paper exchange's own calls, beyond the Slipstream and Chainlink interfaces bluechip already reads: what the
 * operator calls on Base Sepolia to mint test money, write the feeds and set up the pools (`contracts/src/paper/`).
 * The rest of paper reads through the shared ABIs (`erc20Abi`, `aggregatorAbi`, `market/Aerodrome.ts`).
 *
 * @since 0.0.0
 */
import { parseAbi } from "viem"

/**
 * Test USDC and the test stocks (`MintableToken`): their owner, the operator, mints and names minters (the pools).
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const paperTokenAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function setMinter(address minter, bool allowed)",
  "function isMinter(address minter) view returns (bool)",
  "function owner() view returns (address)",
  "error NotMinter()"
])

/**
 * `PaperFeedWriter`: writes every moved feed in one transaction (`answers` at 8 decimals, as of the block's time).
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const paperFeedWriterAbi = parseAbi([
  "function push(address[] feeds, int256[] answers)",
  "function owner() view returns (address)",
  "error LengthMismatch()",
  "error InvalidAnswer()"
])

/**
 * `PaperFactory`'s owner calls: a stock's pool against test USDC, priced from its feed and keeping `fee` pips.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const paperFactoryAbi = parseAbi([
  "function createPool(address stock, address feed, int24 tickSpacing, uint24 fee) returns (address pool)",
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address)",
  "error PoolExists()",
  "error InvalidPool()"
])

/**
 * `PaperPool`'s reads and refusals: its feed, the price it fills at (8 decimals) and its quote.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const paperPoolAbi = parseAbi([
  "function feed() view returns (address)",
  "function price() view returns (uint256)",
  "function quote(address tokenIn, uint256 amountIn) view returns (uint256 amountOut)",
  "error UnknownToken()",
  "error InvalidPrice()",
  "error StalePrice()",
  "error NothingToSwap()"
])
