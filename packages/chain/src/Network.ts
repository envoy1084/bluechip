/**
 * Which Base bluechip runs against.
 *
 * @since 0.0.0
 */
import * as Config from "effect/Config"

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
