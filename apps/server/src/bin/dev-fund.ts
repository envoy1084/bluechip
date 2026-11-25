import { ChainClient } from "@bluechip/chain/ChainClient"
import { DevChain } from "@bluechip/chain/DevChain"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { getAddress, parseEther, parseUnits } from "viem"

// `pnpm --filter @bluechip/server dev:fund <address> [--usdc 1000] [--eth 1]`: fork money for local testing.
// DevChain refuses to run unless NETWORK=local.
const devFund = Command.make("dev-fund", {
  address: Argument.String("address").pipe(
    Argument.mapTryCatch(getAddress, () => "not an address"),
    Argument.withDescription("The account to fund on the local fork")
  ),
  usdc: Flag.Finite("usdc").pipe(Flag.withDefault(1000), Flag.withDescription("USDC to set as its balance")),
  eth: Flag.Finite("eth").pipe(Flag.withDefault(1), Flag.withDescription("ETH to set as its balance"))
}, ({ address, eth, usdc }) =>
  Effect.gen(function*() {
    const dev = yield* DevChain
    yield* dev.setEthBalance(address, parseEther(String(eth)))
    yield* dev.setUsdcBalance(address, parseUnits(String(usdc), 6))
    yield* Console.log(`${address} now holds ${eth} ETH and ${usdc} USDC on the local fork`)
  }))

devFund.pipe(
  Command.run({ version: "0.0.0" }),
  Effect.provide(Layer.mergeAll(NodeServices.layer, Layer.provide(DevChain.layer, ChainClient.layer))),
  NodeRuntime.runMain
)
