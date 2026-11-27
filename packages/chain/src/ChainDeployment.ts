/**
 * The deployment of the network bluechip runs against, as a service.
 *
 * @since 0.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Deployment } from "./Deployment.ts"
import { baseDeployment, localDeployment } from "./deployments/Base.ts"
import { sepoliaDeployment } from "./deployments/SepoliaDeployment.ts"
import { type Network, NetworkConfig } from "./Network.ts"

const DEPLOYMENTS: { readonly [N in Network]: Deployment } = {
  local: localDeployment,
  sepolia: sepoliaDeployment,
  base: baseDeployment
}

/**
 * The deployment on `network`.
 *
 * **Example** (Base's USDC)
 *
 * ```ts import.meta.vitest
 * import { deploymentOf } from "@bluechip/chain/ChainDeployment"
 *
 * deploymentOf("base").usdc
 * // "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 * ```
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const deploymentOf = (network: Network): Deployment => DEPLOYMENTS[network]

/**
 * The {@link Deployment} of the network bluechip runs against: its addresses, stocks and explorer.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class ChainDeployment extends Context.Service<ChainDeployment, Deployment>()("@bluechip/chain/ChainDeployment") {
  /**
   * From `NETWORK` (`local` by default).
   *
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(ChainDeployment, Effect.map(NetworkConfig, deploymentOf))

  /**
   * The deployment on `network`.
   *
   * @since 0.0.0
   */
  static readonly layerFor = (network: Network) => Layer.succeed(ChainDeployment, deploymentOf(network))
}
