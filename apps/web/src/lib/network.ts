import { deploymentOf } from "@bluechip/chain/ChainDeployment"
import type { Deployment } from "@bluechip/chain/Deployment"
import { type Network, networks } from "@bluechip/chain/Network"

/**
 * The network from `VITE_NETWORK`, `local` by default: `local` is the local chain `pnpm dev` runs (same chain id as
 * Base, fake money); `sepolia` is paper money on Base Sepolia; `base` is Base mainnet. The server reports its own,
 * and the app refuses to run against a server on another network.
 */
export const network: Network = networks.find((candidate) => candidate === import.meta.env["VITE_NETWORK"]) ?? "local"

/** The network's addresses, stocks and explorer. */
export const deployment: Deployment = deploymentOf(network)

/** A transaction on the network's block explorer. */
export const explorerTxUrl = (hash: string): string => `${deployment.explorerUrl}/tx/${hash}`

/** Each network as a sentence names it. */
export const NETWORK_NAMES: Readonly<Record<Network, string>> = {
  local: "the local chain",
  sepolia: "paper money on Base Sepolia",
  base: "Base"
}
