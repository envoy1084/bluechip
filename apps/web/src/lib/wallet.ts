import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import { createConfig, http } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { baseAccount, injected } from "wagmi/connectors"
import { network } from "./network.ts"

// The app reads the chain through bluechip's server (`/api/rpc`, forwarded to the server's own node), so no RPC key
// reaches the browser: the page's own origin, as the API client's; only the browser reads the chain (pages that do
// render there). A browser wallet on the local chain needs a custom network: RPC http://localhost:8545, chain 8453.
const rpcUrl = typeof window === "undefined" ? "http://localhost/api/rpc" : `${window.location.origin}/api/rpc`

const transport = http(rpcUrl, {
  fetchOptions: { credentials: "same-origin", headers: { [contractVersionHeader]: String(ContractVersion) } }
})

export const wagmiConfig = network === "sepolia" ?
  createConfig({
    chains: [baseSepolia],
    connectors: [injected(), baseAccount({ appName: "bluechip" })],
    transports: { [baseSepolia.id]: transport },
    ssr: true
  }) :
  createConfig({
    chains: [base],
    connectors: [injected(), baseAccount({ appName: "bluechip" })],
    transports: { [base.id]: transport },
    ssr: true
  })

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig
  }
}
