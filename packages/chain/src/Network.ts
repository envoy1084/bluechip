/**
 * Which chain bluechip runs against.
 *
 * @since 0.0.0
 */
import * as Config from "effect/Config"

/**
 * `local` is the devnet (or an Anvil fork) copying Base mainnet (same chain id and contracts, fake money); `sepolia`
 * is paper money on Base Sepolia (bluechip's own test USDC, stocks, feeds and exchange); `base` is Base mainnet.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Network = "local" | "sepolia" | "base"

/**
 * Every {@link Network}.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const networks: ReadonlyArray<Network> = ["local", "sepolia", "base"]

/**
 * `NETWORK` from the environment, `local` by default.
 *
 * @stability unstable
 * @category config
 * @since 0.0.0
 */
export const NetworkConfig: Config.Config<Network> = Config.Literals(networks, "NETWORK").pipe(
  Config.withDefault("local")
)
