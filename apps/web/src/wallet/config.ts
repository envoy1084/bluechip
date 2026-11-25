import { createConfig, http } from "wagmi"
import { base } from "wagmi/chains"
import { baseAccount, injected } from "wagmi/connectors"

/**
 * `local` reads the Anvil fork from `docker compose --profile chain up -d` (same chain id as Base, fake money);
 * `base` reads Base mainnet. A browser wallet on the fork needs a custom network: RPC http://localhost:8545, chain 8453.
 */
const network = import.meta.env["VITE_NETWORK"] === "base" ? "base" : "local"

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected(), baseAccount({ appName: "bluechip" })],
  transports: { [base.id]: http(network === "local" ? "http://localhost:8545" : undefined) },
  ssr: true
})

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig
  }
}
