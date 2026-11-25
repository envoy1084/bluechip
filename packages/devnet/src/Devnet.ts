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
import { type Address, encodeFunctionData, type Hex, pad, parseAbi, toHex } from "viem"
import { mnemonicToAccount } from "viem/accounts"

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
 * Anvil's first development account: the admin, minter and operator of the devnet's stock tokens.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DEVNET_ADMIN: Address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

const tokenAbi = parseAbi(["function mint(address to, uint256 amount)"])

// The devnet's feeds keep the answer in slot 0 and when it was updated in slot 1 (`contracts/src/MockFeed.sol`).
const ANSWER_SLOT = pad("0x00")
const UPDATED_AT_SLOT = pad("0x01")

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

        const request = (url: string, method: string, params: ReadonlyArray<unknown> = []) =>
          Effect.promise(async () => {
            const response = await fetch(url, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
            })
            const body = await response.json() as { result?: unknown; error?: { message: string } }
            if (body.error !== undefined) throw new Error(`Devnet: ${method}: ${body.error.message}`)
            return body.result
          })
        const anvil = (method: string, params?: ReadonlyArray<unknown>) => request(rpcUrl, method, params)
        const now = () => Math.floor(Date.now() / 1000)

        const setPrice = Effect.fnUntraced(
          function*(symbol: string, price: bigint, options: { readonly ageSeconds?: number } = {}) {
            const { feed } = stockOf(symbol)
            yield* anvil("anvil_setStorageAt", [feed, ANSWER_SLOT, pad(toHex(price))])
            yield* anvil("anvil_setStorageAt", [feed, UPDATED_AT_SLOT, pad(toHex(now() - (options.ageSeconds ?? 0)))])
          }
        )

        const mintShares = (account: Address, symbol: string, shares: bigint) =>
          anvil("eth_sendTransaction", [{
            from: DEVNET_ADMIN,
            to: stockOf(symbol).token,
            data: encodeFunctionData({ abi: tokenAbi, functionName: "mint", args: [account, shares] })
          }]).pipe(Effect.asVoid)

        yield* anvil("anvil_mine", ["0x1"])
        yield* Effect.forEach(stocks, ({ feed }) =>
          anvil("anvil_setStorageAt", [feed, UPDATED_AT_SLOT, pad(toHex(now()))]), { discard: true })
        // Alto starts on its first request; let it start now, against the ready chain.
        yield* request(bundlerUrl, "eth_supportedEntryPoints")

        return { rpcUrl, bundlerUrl, setPrice, mintShares }
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
