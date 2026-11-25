/**
 * What the devnet lets you do that Base doesn't, over JSON-RPC: set a feed's price, mint stock tokens, and move a
 * pool's price by trading against it. Shared by the `Devnet` test service and `pnpm dev`'s price sync.
 *
 * @since 0.0.0
 */
import { type Stock, usdc } from "@bluechip/chain/Contracts"
import { swapRouter } from "@bluechip/chain/market/Aerodrome"
import {
  type Address,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  maxUint256,
  pad,
  parseAbi,
  toHex
} from "viem"
import { mnemonicToAccount } from "viem/accounts"
import { sqrtPriceX96Of } from "./Pools.ts"

/**
 * Anvil's first development account: the admin, minter and operator of the devnet's stock tokens, and the trader
 * that moves pools.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DEVNET_ADMIN: Address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

const developmentKey = (addressIndex: number): Hex =>
  toHex(
    mnemonicToAccount("test test test test test test test test test test test junk", { addressIndex })
      .getHdKey().privateKey!
  )

/**
 * Alto's keys: two of Anvil's development accounts, which hold test ETH on the devnet only.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const BUNDLER_KEYS = { executor: developmentKey(8), utility: developmentKey(9) } as const

const abi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, bool)",
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256)"
])

// The devnet's feeds keep the answer in slot 0 and when it was updated in slot 1 (`contracts/src/MockFeed.sol`).
const ANSWER_SLOT = pad("0x00")
const UPDATED_AT_SLOT = pad("0x01")

// FiatTokenV2_2 keeps balances in `balanceAndBlacklistStates`, slot 9.
const usdcBalanceSlot = (account: Address) =>
  keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [account, BigInt(9)]))

// What the admin keeps on hand to trade pools: far more than any pool holds.
const TRADING_FLOAT = BigInt(10) ** BigInt(15)

/**
 * A JSON-RPC connection to an Anvil node.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Rpc = (method: string, params?: ReadonlyArray<unknown>) => Promise<unknown>

/**
 * Connects to the node at `url`.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const rpc = (url: string): Rpc => async (method, params = []) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  })
  const body = await response.json() as { result?: unknown; error?: { message: string } }
  if (body.error !== undefined) throw new Error(`devnet: ${method}: ${body.error.message}`)
  return body.result
}

// Sends a transaction from the admin and waits for it: Anvil answers before automine has the block.
const transact = async (node: Rpc, to: Address, data: Hex) => {
  const hash = await node("eth_sendTransaction", [{ from: DEVNET_ADMIN, to, data }])
  for (;;) {
    const receipt = await node("eth_getTransactionReceipt", [hash]) as { status: Hex } | null
    if (receipt !== null) {
      if (receipt.status !== "0x1") throw new Error(`devnet: a transaction to ${to} reverted`)
      return
    }
  }
}

const read = async (node: Rpc, to: Address, data: Hex) => await node("eth_call", [{ to, data }, "latest"]) as Hex

/**
 * Sets a feed's answer (USD per token, 8 decimals) and when it was updated (Unix seconds).
 *
 * @stability unstable
 * @category controls
 * @since 0.0.0
 */
export const setFeed = async (node: Rpc, feed: Address, price: bigint, updatedAt: number) => {
  await node("anvil_setStorageAt", [feed, ANSWER_SLOT, pad(toHex(price))])
  await node("anvil_setStorageAt", [feed, UPDATED_AT_SLOT, pad(toHex(updatedAt))])
}

/**
 * Marks a feed's answer as updated at `updatedAt` (Unix seconds), keeping the answer.
 *
 * @stability unstable
 * @category controls
 * @since 0.0.0
 */
export const setFeedTime = async (node: Rpc, feed: Address, updatedAt: number) => {
  await node("anvil_setStorageAt", [feed, UPDATED_AT_SLOT, pad(toHex(updatedAt))])
}

/**
 * Mints `shares` (8 decimals) of a stock token to `account`.
 *
 * @stability unstable
 * @category controls
 * @since 0.0.0
 */
export const mintShares = (node: Rpc, token: Address, account: Address, shares: bigint) =>
  transact(node, token, encodeFunctionData({ abi, functionName: "mint", args: [account, shares] }))

/**
 * Trades against a stock's pool until it prices the stock at `price` (USD per token, 8 decimals): buying the stock
 * raises its price, selling lowers it. The admin trades from a float it tops up first.
 *
 * @stability unstable
 * @category controls
 * @since 0.0.0
 */
export const movePool = async (node: Rpc, stock: Stock, price: bigint) => {
  if (stock.pool === null) return

  const [current] = decodeAbiParameters(
    [{ type: "uint160" }],
    await read(node, stock.pool.address, encodeFunctionData({ abi, functionName: "slot0" }))
  )
  const target = sqrtPriceX96Of(price)
  if (target === current) return

  // The pool's price is stock per USDC: a higher stock price is a lower `sqrtPriceX96`, reached by paying in USDC.
  const buying = target < current
  const tokenIn = buying ? usdc : stock.token
  const tokenOut = buying ? stock.token : usdc

  if (buying) {
    await node("anvil_setStorageAt", [usdc, usdcBalanceSlot(DEVNET_ADMIN), pad(toHex(TRADING_FLOAT))])
  } else {
    const [held] = decodeAbiParameters(
      [{ type: "uint256" }],
      await read(node, stock.token, encodeFunctionData({ abi, functionName: "balanceOf", args: [DEVNET_ADMIN] }))
    )
    if (held < TRADING_FLOAT) await mintShares(node, stock.token, DEVNET_ADMIN, TRADING_FLOAT)
  }

  await transact(node, tokenIn, encodeFunctionData({ abi, functionName: "approve", args: [swapRouter, maxUint256] }))
  // Paying more than the pool can take, with the target as the price limit: the swap stops at the target and the
  // router takes only what was used.
  await transact(
    node,
    swapRouter,
    encodeFunctionData({
      abi,
      functionName: "exactInputSingle",
      args: [{
        tokenIn,
        tokenOut,
        tickSpacing: stock.pool.tickSpacing,
        recipient: DEVNET_ADMIN,
        deadline: BigInt(2) ** BigInt(40),
        amountIn: TRADING_FLOAT,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: target
      }]
    })
  )
}
