/**
 * Which Base bluechip runs against.
 *
 * @since 0.0.0
 */
import * as Config from "effect/Config"
import type { Address } from "viem"
import { usdc } from "./Contracts.ts"

/**
 * `local` is the Anvil fork of Base mainnet from `docker compose --profile chain up -d` (same chain id, fake money);
 * `base` is Base mainnet.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Network = "local" | "base"

/**
 * `NETWORK` from the environment, `local` by default.
 *
 * @stability unstable
 * @category config
 * @since 0.0.0
 */
export const NetworkConfig: Config.Config<Network> = Config.Literals(["local", "base"], "NETWORK").pipe(
  Config.withDefault("local")
)

/**
 * What a wallet needs to pay into a network: its chain id and the USDC contract there. The local chain is a copy of
 * Base, so it has Base's chain id and contracts.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface NetworkChain {
  readonly chainId: number
  readonly usdc: Address
}

/**
 * Each {@link Network}'s chain.
 *
 * @stability unstable
 * @category config
 * @since 0.0.0
 */
export const networkChains: { readonly [N in Network]: NetworkChain } = {
  local: { chainId: 8453, usdc },
  base: { chainId: 8453, usdc }
}
