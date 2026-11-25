/**
 * Token transfers into and out of bluechip's accounts, read from `Transfer` logs in small block windows.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import { type Address, erc20Abi, type Hash } from "viem"
import type { ChainClient } from "../ChainClient.ts"

/**
 * One `Transfer` log.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface TokenTransfer {
  readonly token: Address
  readonly from: Address
  readonly to: Address
  readonly value: bigint
  readonly blockNumber: bigint
  readonly txHash: Hash
  readonly logIndex: number
}

const transferEvent = erc20Abi.find((item) => item.type === "event" && item.name === "Transfer")!

/**
 * Every transfer of `tokens` into or out of `accounts` in blocks `fromBlock`–`toBlock`, oldest first. Providers cap
 * how many blocks one `eth_getLogs` may span (Alchemy's free tier: 10), so the range is read `maxRange` blocks at a
 * time; each window costs two calls (in and out).
 *
 * @stability unstable
 * @category reads
 * @since 0.0.0
 */
export const readTransfers = (
  chain: ChainClient["Service"],
  options: {
    readonly tokens: ReadonlyArray<Address>
    readonly accounts: ReadonlyArray<Address>
    readonly fromBlock: bigint
    readonly toBlock: bigint
    readonly maxRange: number
  }
) =>
  chain.use("read transfers", async (client) => {
    const found: Array<TokenTransfer> = []
    const step = BigInt(options.maxRange)
    for (let start = options.fromBlock; start <= options.toBlock; start += step) {
      const end = start + step - BigInt(1) < options.toBlock ? start + step - BigInt(1) : options.toBlock
      const window = { address: [...options.tokens], event: transferEvent, fromBlock: start, toBlock: end }
      const [incoming, outgoing] = await Promise.all([
        client.getLogs({ ...window, args: { to: [...options.accounts] } }),
        client.getLogs({ ...window, args: { from: [...options.accounts] } })
      ])
      const seen = new Set<string>()
      for (const log of [...incoming, ...outgoing]) {
        const key = `${log.transactionHash}:${log.logIndex}`
        if (seen.has(key)) continue
        seen.add(key)
        found.push({
          token: log.address,
          from: log.args.from!,
          to: log.args.to!,
          value: log.args.value!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.logIndex
        })
      }
    }
    return found.sort((a, b) =>
      a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1
    )
  }).pipe(Effect.withSpan("chain.readTransfers"))
