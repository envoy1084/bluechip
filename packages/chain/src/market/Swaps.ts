/**
 * Buying and selling a stock in its Aerodrome pool from a bluechip account: the calls that swap, and what actually
 * moved, read back from the transaction's logs.
 *
 * @since 0.0.0
 */
import { type Address, decodeEventLog, encodeFunctionData, erc20Abi, type Hex, isAddressEqual, type Log } from "viem"
import type { Deployment, Stock } from "../Deployment.ts"
import { swapRouterAbi } from "./Aerodrome.ts"

/**
 * Gas estimates come in short for a swap: Aerodrome's swap hook on Base records each swap only when enough gas is left,
 * and reverts (`IG`) otherwise, so the estimate finds the cheaper path that then fails (~186k against ~372k used).
 * Swap operations get at least this much call gas.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const swapCallGas = BigInt(800_000)

/**
 * A trade in one stock's pool: spend `amountIn` of USDC (buy) or of the stock's token (sell), getting at least
 * `minimumOut` back before `deadline`.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Swap {
  readonly stock: Stock
  readonly side: "buy" | "sell"
  readonly amountIn: bigint
  readonly minimumOut: bigint
  readonly recipient: Address
  readonly deadline: bigint
}

const tokensOf = ({ usdc }: Deployment, { side, stock }: Pick<Swap, "stock" | "side">) =>
  side === "buy" ? { tokenIn: usdc, tokenOut: stock.token } : { tokenIn: stock.token, tokenOut: usdc }

/**
 * The account's calls for a swap on `deployment`: approve its router for exactly `amountIn`, then swap in the stock's
 * pinned pool.
 *
 * @stability unstable
 * @category calls
 * @since 0.0.0
 */
export const swapCalls = (
  deployment: Deployment,
  swap: Swap
): ReadonlyArray<{ readonly to: Address; readonly data: Hex }> => {
  const { tokenIn, tokenOut } = tokensOf(deployment, swap)
  const swapRouter = deployment.exchange.router

  return [
    {
      to: tokenIn,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [swapRouter, swap.amountIn] })
    },
    {
      to: swapRouter,
      data: encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "exactInputSingle",
        args: [{
          tokenIn,
          tokenOut,
          tickSpacing: swap.stock.pool!.tickSpacing,
          recipient: swap.recipient,
          deadline: swap.deadline,
          amountIn: swap.amountIn,
          amountOutMinimum: swap.minimumOut,
          sqrtPriceLimitX96: BigInt(0)
        }]
      })
    }
  ]
}

/**
 * What a swap moved for `account`, from the transaction's `Transfer` logs: the input that left it for the stock's pool
 * and the output that came back from that pool, so each swap of an operation that made several reads only its own.
 * `undefined` when the logs don't show both (the swap didn't happen).
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const fillOf = (
  deployment: Deployment,
  logs: ReadonlyArray<Log>,
  swap: Pick<Swap, "stock" | "side">,
  account: Address
): { readonly amountIn: bigint; readonly amountOut: bigint } | undefined => {
  const { tokenIn, tokenOut } = tokensOf(deployment, swap)
  const pool = swap.stock.pool?.address
  if (pool === undefined) return undefined
  let amountIn = BigInt(0)
  let amountOut = BigInt(0)

  for (const log of logs) {
    let event
    try {
      event = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics })
    } catch {
      continue
    }
    if (event.eventName !== "Transfer") continue
    const { from, to, value } = event.args

    if (isAddressEqual(log.address, tokenIn) && isAddressEqual(from, account) && isAddressEqual(to, pool)) {
      amountIn += value
    }
    if (isAddressEqual(log.address, tokenOut) && isAddressEqual(from, pool) && isAddressEqual(to, account)) {
      amountOut += value
    }
  }

  return amountIn > BigInt(0) && amountOut > BigInt(0) ? { amountIn, amountOut } : undefined
}
