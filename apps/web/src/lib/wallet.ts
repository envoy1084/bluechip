import type { Network } from "@bluechip/chain/Network"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { createConfig, http } from "wagmi"
import { base } from "wagmi/chains"
import { baseAccount, injected } from "wagmi/connectors"

/**
 * `local` is the local chain `pnpm dev` runs (same chain id as Base, fake money); `base` is Base mainnet. Either way
 * the app reads the chain through bluechip's server (`/api/rpc`, forwarded to the server's own node), so no RPC key
 * reaches the browser. A browser wallet on the local chain needs a custom network: RPC http://localhost:8545, chain
 * 8453.
 */
export const network: Network = import.meta.env["VITE_NETWORK"] === "base" ? "base" : "local"

// The page's own origin, as the API client's; only the browser reads the chain (pages that do render there).
const rpcUrl = typeof window === "undefined" ? "http://localhost/api/rpc" : `${window.location.origin}/api/rpc`

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected(), baseAccount({ appName: "bluechip" })],
  transports: {
    [base.id]: http(rpcUrl, {
      fetchOptions: { credentials: "same-origin", headers: { [contractVersionHeader]: String(ContractVersion) } }
    })
  },
  ssr: true
})

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig
  }
}
