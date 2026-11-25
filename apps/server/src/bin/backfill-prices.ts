import { ChainClient } from "@bluechip/chain/ChainClient"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { Database } from "../db/Database.ts"
import { LoggingLive } from "../Logging.ts"
import { backfillPrices } from "../market/Backfill.ts"

// `pnpm --filter @bluechip/server prices:backfill [--rpc-url <url>]`: stores every stock's full price history.
// History before the fork block is the same on Base and on the fork, and reading it straight from a Base RPC costs
// a few hundred calls where the fork would fetch each storage slot separately, so pass your Base RPC here.
const backfill = Command.make("backfill-prices", {
  rpcUrl: Flag.String("rpc-url").pipe(Flag.optional, Flag.withDescription("Base RPC to read history from"))
}, ({ rpcUrl }) =>
  Effect.gen(function*() {
    const url = Option.isSome(rpcUrl) ? rpcUrl.value : yield* Config.String("BASE_RPC_URL")
    return yield* backfillPrices.pipe(Effect.provideService(ChainClient, ChainClient.make("base", url)))
  }))

backfill.pipe(
  Command.run({ version: "0.0.0" }),
  Effect.provide(Layer.mergeAll(NodeServices.layer, Database.layerMigrated, LoggingLive)),
  NodeRuntime.runMain
)
