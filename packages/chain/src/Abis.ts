/**
 * The ABIs bluechip reads. ERC-20 calls use viem's `erc20Abi`.
 *
 * @since 0.0.0
 */
import { parseAbi } from "viem"

/**
 * B20 stock tokens (ERC-20 plus the issuer's corporate-action multiplier, 18 decimals of precision).
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const b20Abi = parseAbi([
  "function multiplier() view returns (uint256)",
  "function scaledBalanceOf(address account) view returns (uint256)"
])

/**
 * Chainlink price feeds. Stock feeds have 8 decimals and already include the token's multiplier.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const aggregatorAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
])
