import { ChainClient } from "@bluechip/chain/ChainClient"
import * as Layer from "effect/Layer"

/** The local fork from `docker compose --profile chain up -d`. */
export const forkUrl = "http://localhost:8545"

/** Whether the fork answers, so fork tests can skip (with a reason) on machines without it. */
export const forkAvailable = await fetch(forkUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] })
}).then((response) => response.ok, () => false)

if (!forkAvailable) console.warn(`Skipping fork tests: no node at ${forkUrl} (docker compose --profile chain up -d)`)

export const ForkChainClient = Layer.succeed(ChainClient, ChainClient.make("local", forkUrl))
