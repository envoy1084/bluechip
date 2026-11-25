import { ChainClient } from "@bluechip/chain/ChainClient"
import { usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { assetTokens, readBalances } from "@bluechip/chain/funding/Balances"
import { readTransfers } from "@bluechip/chain/funding/Transfers"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createTestClient, createWalletClient, erc20Abi, http, parseEther } from "viem"
import { base } from "viem/chains"
import { forkAvailable, ForkChainClient, forkUrl } from "../support/fork.ts"

const sender = "0x00000000000000000000000000000000000f0a10" as const
const alice = "0x00000000000000000000000000000000000a11ce" as const
const bob = "0x0000000000000000000000000000000000000b0b" as const

describe.skipIf(!forkAvailable)("funding on the local fork", () => {
  layer(Layer.provideMerge(DevChain.layer, ForkChainClient))((it) => {
    it.effect("reads balances at one block and finds the transfers that changed them", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const dev = yield* DevChain
        yield* dev.setEthBalance(sender, parseEther("1"))
        yield* dev.setUsdcBalance(sender, BigInt(10_000_000))
        yield* dev.setUsdcBalance(alice, BigInt(0))
        yield* dev.setUsdcBalance(bob, BigInt(0))
        const before = yield* readBalances(chain, [alice, bob])

        yield* chain.use("send", async (client) => {
          const anvil = createTestClient({ chain: base, mode: "anvil", transport: http(forkUrl) })
          const wallet = createWalletClient({ chain: base, account: sender, transport: http(forkUrl) })
          await anvil.impersonateAccount({ address: sender })
          for (const [to, amount] of [[alice, 3_000_000], [bob, 1_000_000]] as const) {
            await client.waitForTransactionReceipt({
              hash: await wallet.writeContract({
                address: usdc,
                abi: erc20Abi,
                functionName: "transfer",
                args: [to, BigInt(amount)]
              })
            })
          }
        })

        const after = yield* readBalances(chain, [alice, bob])
        assert.isTrue(after.blockNumber > before.blockNumber)
        assert.strictEqual(after.balances.get(alice)!.length, assetTokens.length)
        assert.strictEqual(after.balances.get(alice)![0], BigInt(3_000_000))
        assert.strictEqual(after.balances.get(bob)![0], BigInt(1_000_000))

        // A window of 1 block makes the reader split the range, as it must on Alchemy's free tier.
        const transfers = yield* readTransfers(chain, {
          tokens: assetTokens,
          accounts: [alice],
          fromBlock: before.blockNumber + BigInt(1),
          toBlock: after.blockNumber,
          maxRange: 1
        })
        assert.deepStrictEqual(
          transfers.map((transfer) => [transfer.from.toLowerCase(), transfer.to.toLowerCase(), transfer.value]),
          [[sender, alice, BigInt(3_000_000)]]
        )
      }))
  })
})
