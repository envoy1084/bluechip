/**
 * What a swap in a stock's pool would return right now.
 *
 * @since 0.0.0
 */
import type { Address } from "viem"
import type { ChainClient } from "../ChainClient.ts"
import { metaquoterAbi } from "./Aerodrome.ts"

/**
 * The amount out of swapping `amountIn` of `tokenIn` in `pool`, simulated by the exchange's quoter at the latest block.
 * Fails with a `ChainError` when the pool can't fill it.
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const quoteExactIn = (
  chain: ChainClient["Service"],
  input: { readonly pool: Address; readonly tokenIn: Address; readonly amountIn: bigint }
) =>
  chain.use("quote", async (client) => {
    const { result } = await client.simulateContract({
      address: chain.deployment.exchange.quoter,
      abi: metaquoterAbi,
      functionName: "quoteExactInputSingleV3",
      args: [input.pool, input.tokenIn, input.amountIn, BigInt(0)]
    })
    return result[0]
  })
