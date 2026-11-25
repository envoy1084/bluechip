import { ChainClient } from "@bluechip/chain/ChainClient"
import { DevChain } from "@bluechip/chain/DevChain"
import * as Layer from "effect/Layer"

const forkUrl = "http://localhost:8545"
const bundlerUrl = "http://localhost:4337"

const answers = (url: string, method: string) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] })
  }).then((response) => response.ok, () => false)

/** Whether the local fork and bundler (`docker compose --profile chain up -d`) are running. */
export const chainAvailable = (await answers(forkUrl, "eth_chainId")) &&
  (await answers(bundlerUrl, "eth_supportedEntryPoints"))

if (!chainAvailable) console.warn("Skipping fork tests: run `docker compose --profile chain up -d`")

/** The fork's chain client and its cheatcodes. */
export const ForkLayer = Layer.provideMerge(
  DevChain.layer,
  Layer.succeed(ChainClient, ChainClient.make("local", forkUrl))
)
