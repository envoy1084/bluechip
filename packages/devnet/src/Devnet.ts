/**
 * A local Base for tests. Every contract bluechip uses sits at its real address (EntryPoint 0.7, Kernel 3.3,
 * Namera, USDC, the 13 stocks as real B20 tokens, Aerodrome Slipstream with seeded pools), with Chainlink's feeds
 * replaced by ones the test sets. Each Vitest worker has its own Anvil and Alto (see `globalSetup`).
 *
 * @since 0.0.0
 */
import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Server } from "prool/vitest"
import { type Address, encodeFunctionData, type Hex, toHex } from "viem"
import {
  entryPoint07Abi,
  entryPoint07Address,
  toPackedUserOperation,
  type UserOperation
} from "viem/account-abstraction"
import * as Controls from "./Controls.ts"

/**
 * The URLs `globalSetup` provides to test workers, under `contextKey`.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type DevnetContext = {
  readonly anvil: { readonly url: string }
  readonly alto: { readonly url: string }
}

/**
 * The key the devnet's context is provided under; read it in a test with Vitest's `inject`.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const contextKey = "@bluechip/devnet/Devnet" as const

const stockOf = (symbol: string) => {
  const stock = stocks.find((candidate) => candidate.symbol === symbol)
  if (stock === undefined) throw new Error(`Devnet: no stock ${symbol}`)
  return stock
}

/**
 * The current worker's devnet and the controls tests need beyond the chain's own: prices and stock balances.
 * Cash and ETH come from `DevChain`, which works on the devnet as on a fork.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class Devnet extends Context.Service<Devnet, {
  readonly rpcUrl: string
  readonly bundlerUrl: string
  /** Sets a stock's Chainlink price (USD per token, 8 decimals), updated `ageSeconds` ago (0 by default). */
  readonly setPrice: (symbol: string, price: bigint, options?: { readonly ageSeconds?: number }) => Effect.Effect<void>
  /** Mints `shares` (8 decimals) of a stock to `account`. */
  readonly mintShares: (account: Address, symbol: string, shares: bigint) => Effect.Effect<void>
  /** Trades against a stock's pool until it prices the stock at `price` (USD per token, 8 decimals). */
  readonly movePool: (symbol: string, price: bigint) => Effect.Effect<void>
  /**
   * Runs `effect` on the chain `seconds` ahead of now, then puts the chain back as it was (a snapshot), so the
   * worker's later tests see the real time again: the bundler checks operations against the wall clock.
   */
  readonly inFuture: <A, E, R>(seconds: number, effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  /**
   * Sends signed user operations straight to the EntryPoint from the admin, as a bundler would, and says whether the
   * transaction went through. The bundler refuses an operation not valid yet by the wall clock; this lets a test
   * check what the EntryPoint itself decides on a chain moved ahead (`inFuture`).
   */
  readonly handleOps: (operations: ReadonlyArray<UserOperation<"0.7">>) => Effect.Effect<boolean>
}>()("@bluechip/devnet/Devnet") {
  /**
   * Connects to the current worker's devnet: sets Base's base fee (loading the captured state brings the fork's own),
   * moves its clock to now (the captured state brings the capture's) and mines a block, and marks every price as just updated, since the captured state's prices are
   * as old as the capture.
   *
   * @since 0.0.0
   */
  static readonly layer = (context: DevnetContext) =>
    Layer.effect(
      Devnet,
      Effect.gen(function*() {
        const servers = Server.get(context)
        const rpcUrl = servers.anvil.url
        const bundlerUrl = servers.alto.url

        const anvil = Controls.rpc(rpcUrl)
        const now = () => Math.floor(Date.now() / 1000)

        const setPrice = (symbol: string, price: bigint, options: { readonly ageSeconds?: number } = {}) =>
          Effect.promise(() => Controls.setFeed(anvil, stockOf(symbol).feed, price, now() - (options.ageSeconds ?? 0)))
        const mintShares = (account: Address, symbol: string, shares: bigint) =>
          Effect.promise(() => Controls.mintShares(anvil, stockOf(symbol).token, account, shares))
        const movePool = (symbol: string, price: bigint) =>
          Effect.promise(() => Controls.movePool(anvil, stockOf(symbol), price))

        yield* Effect.promise(async () => {
          // The captured state brings back the capture's clock: agents state the latest block's time and Namera
          // bounds their operations to its UTC day, which the bundler checks against the real clock.
          const latest = await anvil("eth_getBlockByNumber", ["latest", false]) as { readonly timestamp: string }
          if (Number(latest.timestamp) < now()) await anvil("anvil_setTime", [now()])
          await anvil("anvil_setNextBlockBaseFeePerGas", [toHex(Controls.BASE_FEE_WEI)])
          await anvil("anvil_mine", ["0x1"])
          for (const { feed } of stocks) await Controls.setFeedTime(anvil, feed, now())
          // Alto starts on its first request; let it start now, against the ready chain.
          await Controls.rpc(bundlerUrl)("eth_supportedEntryPoints")
        })

        const inFuture = <A, E, R>(seconds: number, effect: Effect.Effect<A, E, R>) =>
          Effect.acquireUseRelease(
            Effect.promise(async () => {
              const snapshot = await anvil("evm_snapshot") as Hex
              await anvil("evm_increaseTime", [toHex(seconds)])
              await anvil("anvil_mine", ["0x1"])
              return snapshot
            }),
            () => effect,
            (snapshot) =>
              Effect.promise(async () => {
                await anvil("evm_revert", [snapshot])
                // The snapshot's block keeps its time; the next one is stamped from the wall clock again.
                await anvil("anvil_setTime", [now()])
                await anvil("anvil_mine", ["0x1"])
              })
          )

        const handleOps = (operations: ReadonlyArray<UserOperation<"0.7">>) =>
          Effect.promise(async () => {
            const data = encodeFunctionData({
              abi: entryPoint07Abi,
              functionName: "handleOps",
              args: [operations.map((operation) => toPackedUserOperation(operation)), Controls.DEVNET_ADMIN]
            })
            const hash = await anvil("eth_sendTransaction", [{
              from: Controls.DEVNET_ADMIN,
              to: entryPoint07Address,
              data,
              gas: toHex(5_000_000)
            }])
            for (;;) {
              const receipt = await anvil("eth_getTransactionReceipt", [hash]) as { status: Hex } | null
              if (receipt !== null) return receipt.status === "0x1"
            }
          })

        return { rpcUrl, bundlerUrl, setPrice, mintShares, movePool, inFuture, handleOps }
      })
    )

  /**
   * The chain client (network `local`) and `DevChain`'s controls, on the devnet.
   *
   * @since 0.0.0
   */
  static readonly layerChain = Layer.unwrap(
    Effect.gen(function*() {
      const devnet = yield* Devnet
      return Layer.provideMerge(DevChain.layer, Layer.succeed(ChainClient, ChainClient.make("local", devnet.rpcUrl)))
    })
  )
}
