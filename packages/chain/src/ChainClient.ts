/**
 * Reading Base from Effect.
 *
 * @since 0.0.0
 */
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createPublicClient, http, type HttpTransport, type PublicClient } from "viem"
import { base } from "viem/chains"
import { ChainError } from "./ChainError.ts"
import { type Network, NetworkConfig } from "./Network.ts"

/**
 * A viem client for Base.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type BaseClient = PublicClient<HttpTransport, typeof base>

/**
 * A viem public client for Base (or the local fork, which keeps Base's chain id), with calls batched into
 * multicalls. `use` runs a viem call and turns its failure into a {@link ChainError}.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class ChainClient extends Context.Service<ChainClient, {
  readonly network: Network
  readonly rpcUrl: string
  readonly client: BaseClient
  readonly use: <A>(operation: string, f: (client: BaseClient) => Promise<A>) => Effect.Effect<A, ChainError>
}>()("@bluechip/chain/ChainClient") {
  /**
   * From `NETWORK` and `BASE_RPC_URL` (`http://localhost:8545` by default, the local fork).
   *
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    ChainClient,
    Effect.gen(function*() {
      const network = yield* NetworkConfig
      const rpcUrl = yield* Config.String("BASE_RPC_URL").pipe(Config.withDefault("http://localhost:8545"))
      return ChainClient.make(network, rpcUrl)
    })
  )

  /**
   * A client for the given network and RPC URL.
   *
   * @since 0.0.0
   */
  static make(network: Network, rpcUrl: string): ChainClient["Service"] {
    const client: BaseClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { retryCount: 2 }),
      batch: { multicall: true }
    })
    return {
      network,
      rpcUrl,
      client,
      use: (operation, f) =>
        Effect.tryPromise({ try: () => f(client), catch: (cause) => new ChainError({ operation, cause }) })
    }
  }
}
