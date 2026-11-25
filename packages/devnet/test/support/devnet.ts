import { contextKey, Devnet, type DevnetContext } from "@bluechip/devnet/Devnet"
import { inject } from "@effect/vitest"
import * as Layer from "effect/Layer"

declare module "vitest" {
  interface ProvidedContext {
    readonly [contextKey]: DevnetContext
  }
}

/** This worker's devnet, with the chain client and `DevChain` on it. */
export const DevnetLayer = Layer.provideMerge(Devnet.layerChain, Devnet.layer(inject(contextKey)))
