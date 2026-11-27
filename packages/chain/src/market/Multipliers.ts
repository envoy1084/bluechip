/**
 * Each stock token's multiplier: how many shares one token stands for after the issuer's corporate actions (splits,
 * reinvested dividends). A token's price is the share price times its multiplier.
 *
 * @since 0.0.0
 */
import { b20Abi } from "../Abis.ts"
import type { ChainClient } from "../ChainClient.ts"

/**
 * The multiplier's precision: `1e18` is one share per token.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const multiplierScale = BigInt(10) ** BigInt(18)

/**
 * Every stock token's multiplier (18 decimals) by symbol, in one multicall.
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const readMultipliers = (chain: ChainClient["Service"]) =>
  chain.use("read multipliers", async (client) => {
    const { stocks } = chain.deployment
    const multipliers = await client.multicall({
      contracts: stocks.map((stock) => ({ address: stock.token, abi: b20Abi, functionName: "multiplier" as const })),
      allowFailure: false
    })
    return new Map(stocks.map((stock, index) => [stock.symbol, multipliers[index]!]))
  })
