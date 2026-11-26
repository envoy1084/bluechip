/**
 * The devnet in a test file: this worker's `Devnet`, with the chain client and `DevChain` on it. The project's
 * Vitest `globalSetup` must serve the devnet (`globalSetup.ts`).
 *
 * @since 0.0.0
 */
import * as Layer from "effect/Layer"
import { Server } from "prool/vitest"
import { inject } from "vitest"
import { contextKey, Devnet, type DevnetContext, stateKey } from "./Devnet.ts"

declare module "vitest" {
  interface ProvidedContext {
    readonly [contextKey]: DevnetContext
    readonly [stateKey]: string
  }
}

/**
 * This worker's devnet with `ChainClient` and `DevChain`, for `layer(...)` in a test file.
 *
 * @stability unstable
 * @category layers
 * @since 0.0.0
 */
export const layer = Layer.provideMerge(Devnet.layerChain, Devnet.layer(inject(contextKey)))

/**
 * A devnet of the file's own (`Devnet.layerIsolated`) with `ChainClient` and `DevChain`, for tests that move the
 * chain's clock, which must never move on the worker's shared chain.
 *
 * @stability unstable
 * @category layers
 * @since 0.0.0
 */
export const layerIsolated = Layer.provideMerge(
  // Fresh: the chain layer is memoized, and the shared one would talk to the worker's chain.
  Layer.fresh(Devnet.layerChain),
  Devnet.layerIsolated(inject(stateKey))
)

/**
 * This worker's Anvil and Alto URLs, for code that reads them from config (such as `BUNDLER_URL`).
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const urls = (): { readonly rpcUrl: string; readonly bundlerUrl: string } => {
  const servers = Server.get(inject(contextKey))
  return { rpcUrl: servers.anvil.url, bundlerUrl: servers.alto.url }
}
