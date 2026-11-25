/**
 * Every account's balances of the assets bluechip knows, read in as few calls as possible.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import { type Address, type ContractFunctionParameters, erc20Abi, parseAbi } from "viem"
import type { ChainClient } from "../ChainClient.ts"
import { stocks, usdc } from "../Contracts.ts"

/**
 * What an account can hold: USDC, then every stock, each with its token.
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const assets: ReadonlyArray<{ readonly symbol: string; readonly token: Address }> = [
  { symbol: "USDC", token: usdc },
  ...stocks.map((stock) => ({ symbol: stock.symbol, token: stock.token }))
]

/**
 * The tokens of {@link assets}, in the same order.
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const assetTokens: ReadonlyArray<Address> = assets.map((asset) => asset.token)

/**
 * Balances at one block: `balances.get(account)` lists each of {@link assetTokens}' balance in the same order.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Balances {
  readonly blockNumber: bigint
  readonly timestamp: Date
  readonly balances: ReadonlyMap<Address, ReadonlyArray<bigint>>
}

const multicall3Abi = parseAbi([
  "function getBlockNumber() view returns (uint256)",
  "function getCurrentBlockTimestamp() view returns (uint256)"
])

// 200 accounts × 14 tokens is ~2,800 `balanceOf` calls, ~15M gas: well inside every provider's `eth_call` gas cap.
const ACCOUNTS_PER_CALL = 200

/**
 * Every account's balance of every asset token, all at the same block, with that block's number and time. One
 * `eth_call` per 200 accounts: the first also asks Multicall3 for the block, the rest read at that block.
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const readBalances = (chain: ChainClient["Service"], accounts: ReadonlyArray<Address>) =>
  chain.use("read balances", async (client): Promise<Balances> => {
    const multicall3 = client.chain.contracts.multicall3.address
    const balanceCalls = (owners: ReadonlyArray<Address>): Array<ContractFunctionParameters> =>
      owners.flatMap((owner) =>
        assetTokens.map((token) => ({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner]
        }))
      )
    const [first, ...rest] = chunksOf(accounts, ACCOUNTS_PER_CALL)
    const [blockNumber, timestamp, ...firstBalances] = await client.multicall({
      contracts: [
        { address: multicall3, abi: multicall3Abi, functionName: "getBlockNumber" },
        { address: multicall3, abi: multicall3Abi, functionName: "getCurrentBlockTimestamp" },
        ...balanceCalls(first ?? [])
      ],
      allowFailure: false,
      batchSize: 0
    }) as unknown as [bigint, bigint, ...Array<bigint>]
    const restBalances = await Promise.all(
      rest.map((owners) =>
        client.multicall({ contracts: balanceCalls(owners), allowFailure: false, batchSize: 0, blockNumber })
      )
    )
    const all = [...firstBalances, ...restBalances.flat()] as Array<bigint>
    const balances = new Map(accounts.map((account, index) => [
      account,
      all.slice(index * assetTokens.length, (index + 1) * assetTokens.length)
    ]))
    return { blockNumber, timestamp: new Date(Number(timestamp) * 1000), balances }
  }).pipe(Effect.withSpan("chain.readBalances", { attributes: { accounts: accounts.length } }))

const chunksOf = <A>(items: ReadonlyArray<A>, size: number): Array<ReadonlyArray<A>> =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
