/**
 * Every account's balances of the assets bluechip knows, read in as few calls as possible.
 *
 * @since 0.0.0
 */
import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import { type Address, type ContractFunctionParameters, erc20Abi, parseAbi } from "viem"
import type { ChainClient } from "../ChainClient.ts"
import type { Deployment } from "../Deployment.ts"

/**
 * What an account can hold on `deployment`: USDC, then every stock, each with its token.
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const assetsOf = (
  deployment: Deployment
): ReadonlyArray<{ readonly symbol: string; readonly token: Address }> => [
  { symbol: "USDC", token: deployment.usdc },
  ...deployment.stocks.map((stock) => ({ symbol: stock.symbol, token: stock.token }))
]

/**
 * Balances at one block: `balances.get(account)` lists the balance of each of the chain's {@link assetsOf}, in the
 * same order.
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
    const assetTokens = assetsOf(chain.deployment).map((asset) => asset.token)
    const balanceCalls = (owners: ReadonlyArray<Address>): Array<ContractFunctionParameters> =>
      owners.flatMap((owner) =>
        assetTokens.map((token) => ({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner]
        }))
      )
    // 200 accounts × 14 tokens is ~2,800 `balanceOf` calls, ~15M gas: well inside every provider's `eth_call` gas cap.
    const [first, ...rest] = Arr.chunksOf(accounts, 200)
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
