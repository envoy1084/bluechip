import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { paperFeedWriterAbi, paperTokenAbi } from "@bluechip/chain/deployments/PaperAbis"
import type { TxHash } from "@bluechip/domain/Ids"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Semaphore from "effect/Semaphore"
import { type Address, createWalletClient, http, isAddressEqual } from "viem"
import { privateKeyToAccount } from "viem/accounts"

/**
 * Paper money's operator: the key that owns the test tokens and the feed writer on Base Sepolia
 * (`OPERATOR_PRIVATE_KEY`, the deployment's `paper.operator`). It mints test USDC and writes the feeds, one
 * transaction at a time (one nonce stream), each waited on until it is mined. Only provided where the deployment has
 * paper money; startup fails there without the key, or with another key.
 */
export class Operator extends Context.Service<Operator, {
  readonly address: Address
  /** Mints `amount` of test USDC (6 decimals) to `to`. */
  readonly mintUsdc: (to: Address, amount: bigint) => Effect.Effect<TxHash, ChainError>
  /** Writes each feed's new answer (8 decimals) in one `PaperFeedWriter.push`. */
  readonly pushFeeds: (
    updates: ReadonlyArray<{ readonly feed: Address; readonly answer: bigint }>
  ) => Effect.Effect<TxHash, ChainError>
  /** The operator's ETH, which pays for its transactions. */
  readonly ethBalance: Effect.Effect<bigint, ChainError>
}>()("@bluechip/server/Operator") {
  static readonly layer = Layer.effect(
    Operator,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const paper = chain.deployment.paper
      if (paper === null) return yield* Effect.die(new Error(`Operator: ${chain.network} has no paper money`))

      const account = privateKeyToAccount(
        Redacted.value(yield* Config.Redacted("OPERATOR_PRIVATE_KEY")) as `0x${string}`
      )
      if (!isAddressEqual(account.address, paper.operator)) {
        return yield* Effect.die(
          new Error(`Operator: OPERATOR_PRIVATE_KEY is ${account.address}, not the deployment's ${paper.operator}`)
        )
      }

      const wallet = createWalletClient({ account, chain: chain.deployment.chain, transport: http(chain.rpcUrl) })
      const transactions = yield* Semaphore.make(1)

      const send = (operation: string, write: () => Promise<`0x${string}`>) =>
        transactions.withPermit(chain.use(operation, async (client) => {
          const hash = await write()
          const receipt = await client.waitForTransactionReceipt({ hash })
          if (receipt.status !== "success") throw new Error(`${operation} reverted in ${hash}`)
          return hash as TxHash
        }))

      return Operator.of({
        address: account.address,
        mintUsdc: (to, amount) =>
          send("operator mint test USDC", () =>
            wallet.writeContract({
              address: chain.deployment.usdc,
              abi: paperTokenAbi,
              functionName: "mint",
              args: [to, amount]
            })).pipe(Effect.withSpan("Operator.mintUsdc")),
        pushFeeds: (updates) =>
          send("operator push feeds", () =>
            wallet.writeContract({
              address: paper.feedWriter,
              abi: paperFeedWriterAbi,
              functionName: "push",
              args: [updates.map((update) => update.feed), updates.map((update) => update.answer)]
            })).pipe(Effect.withSpan("Operator.pushFeeds")),
        ethBalance: chain.use("operator balance", (client) => client.getBalance({ address: account.address }))
      })
    })
  )
}
