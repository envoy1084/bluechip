// The devnet's prices for a run: each feed keeps the captured answer, marked as updated at the chain's time, and each
// pool sits at its feed's price. The pools' liquidity is seeded around the captured prices, so moving a pool far from
// them (to the market data's $100, say) leaves it without liquidity and every quote misses the fair price.
import { localDeployment } from "@bluechip/chain/deployments/Base"
import { movePool, type Rpc, setFeedTime } from "@bluechip/devnet/Controls"
import { decodeAbiParameters, encodeFunctionData, type Hex, parseAbi } from "viem"

const abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, bool)",
  "function latestRoundData() view returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80)"
])

const Q96 = BigInt(2) ** BigInt(96)

// How far a pool's mid price may sit from its feed after aligning: Aerodrome's ticks are a basis point apart.
const MAX_GAP_BPS = BigInt(5)

const call = async (node: Rpc, to: Hex, functionName: "slot0" | "latestRoundData") =>
  await node("eth_call", [{ to, data: encodeFunctionData({ abi, functionName }) }, "latest"]) as Hex

const feedPrice = async (node: Rpc, feed: Hex) => {
  const [, answer] = decodeAbiParameters(
    [{ type: "uint80" }, { type: "int256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint80" }],
    await call(node, feed, "latestRoundData")
  )
  return answer
}

// The inverse of the devnet's `sqrtPriceX96Of`: USD per token, 8 decimals.
const poolPrice = async (node: Rpc, pool: Hex) => {
  const [sqrtPriceX96] = decodeAbiParameters([{ type: "uint160" }], await call(node, pool, "slot0"))
  return (BigInt(10) ** BigInt(10) * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96)
}

/** Marks every feed updated at `at` (Unix seconds) and moves every pool to its feed; fails listing any gap left. */
export const alignPrices = async (node: Rpc, at: number) => {
  const gaps: Array<string> = []

  for (const stock of localDeployment.stocks) {
    await setFeedTime(node, stock.feed, at)
    if (stock.pool === null) continue

    const price = await feedPrice(node, stock.feed)
    await movePool(node, stock, price)

    const pool = await poolPrice(node, stock.pool.address)
    const gap = ((pool > price ? pool - price : price - pool) * BigInt(10_000)) / price
    if (gap > MAX_GAP_BPS) gaps.push(`${stock.symbol}: pool ${pool}, feed ${price} (${gap} bps)`)
  }

  if (gaps.length > 0) throw new Error(`e2e: pools away from their feeds after aligning:\n${gaps.join("\n")}`)
}
