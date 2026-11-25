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
import type { Address } from "viem"
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
}>()("@bluechip/devnet/Devnet") {
  /**
   * Connects to the current worker's devnet: mines a block so its clock reads now, and marks every price as just
   * updated, since the captured state's prices are as old as the capture.
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
          await anvil("anvil_mine", ["0x1"])
          for (const { feed } of stocks) await Controls.setFeedTime(anvil, feed, now())
          // Alto starts on its first request; let it start now, against the ready chain.
          await Controls.rpc(bundlerUrl)("eth_supportedEntryPoints")
        })

        return { rpcUrl, bundlerUrl, setPrice, mintShares, movePool }
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
