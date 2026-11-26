/**
 * What the devnet lets you do that Base doesn't, over JSON-RPC: set a feed's price, mint stock tokens, move them out
 * of an account as the account, and move a pool's price by trading against it. Shared by the `Devnet` test service and `pnpm dev`'s price sync.
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

/**
 * The devnet's base fee: Base's usual 0.01 gwei.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const BASE_FEE_WEI = BigInt(10_000_000)

/**
 * Fees for a user operation priced as on Base: twice the base fee, plus a 0.001 gwei tip.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const BASE_FEES = {
  maxFeePerGas: BASE_FEE_WEI * BigInt(2) + BigInt(1_000_000),
  maxPriorityFeePerGas: BigInt(1_000_000)
} as const

const abi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, bool)",
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256)"
])

// The devnet's feeds keep the answer in slot 0 and when it was updated in slot 1 (`contracts/src/MockFeed.sol`).
const ANSWER_SLOT = pad("0x00")
const UPDATED_AT_SLOT = pad("0x01")

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

// Sends a transaction (from the admin unless `from` is given, which Anvil must be impersonating) and waits for it: Anvil
// answers before automine has the block.
const transact = async (node: Rpc, to: Address, data: Hex, gas?: bigint, from: Address = DEVNET_ADMIN) => {
  const hash = await node("eth_sendTransaction", [{ from, to, data, gas: gas && toHex(gas) }])
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
 * Transfers `amount` of `token` from `from` to `to`, sent as `from` (Anvil impersonates it, a smart account too): a
 * transfer made outside whatever owns `from`. `from` keeps the ETH it had: the gas is lent, then taken back.
 *
 * @stability unstable
 * @category controls
 * @since 0.0.0
 */
export const transferTokens = async (node: Rpc, token: Address, from: Address, to: Address, amount: bigint) => {
  const eth = await node("eth_getBalance", [from, "latest"]) as Hex
  await node("anvil_setBalance", [from, toHex(BigInt(eth) + BigInt(10) ** BigInt(16))])
  await node("anvil_impersonateAccount", [from])
  try {
    await transact(
      node,
      token,
      encodeFunctionData({ abi, functionName: "transfer", args: [to, amount] }),
      undefined,
      from
    )
  } finally {
    await node("anvil_stopImpersonatingAccount", [from])
    await node("anvil_setBalance", [from, eth])
  }
}

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
    // FiatTokenV2_2 keeps balances in `balanceAndBlacklistStates`, slot 9.
    const slot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [DEVNET_ADMIN, BigInt(9)]))
    await node("anvil_setStorageAt", [usdc, slot, pad(toHex(TRADING_FLOAT))])
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
    }),
    // Aerodrome's swap hook records a swap only with enough gas left, so Anvil's estimate comes in short.
    BigInt(3_000_000)
  )
}
