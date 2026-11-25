import { Config, Console, Effect, FileSystem, Path, Redacted, Schema } from "effect"
import { Command } from "effect/cli"
import type { Hex } from "viem"

import { captureDevnet } from "../devnet/capture.ts"
import { CheckFailed, ToolFailed } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

/** Where the captured state lives: loaded by every devnet test worker. */
export const DEVNET_STATE = "packages/devnet/state/devnet.state.gz"

const contracts = "packages/devnet/contracts"

const Artifact = Schema.Struct({ deployedBytecode: Schema.Struct({ object: Schema.String }) })

/** Builds the devnet's helper contracts and reads their runtime bytecode. */
const helperCode = Effect.fn("devnet.helperCode")(function*(root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* (yield* Tools).run("forge", ["build", "--quiet"], { cwd: path.join(root, contracts) })

  const runtime = Effect.fnUntraced(function*(name: string) {
    const text = yield* fs.readFileString(path.join(root, contracts, "out", `${name}.sol`, `${name}.json`))
    const artifact = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Artifact))(text)
    return artifact.deployedBytecode.object as Hex
  }, Effect.orDie)
  return { mockFeed: yield* runtime("MockFeed"), poolSeeder: yield* runtime("PoolSeeder") }
})

const capture = Command.make("capture").pipe(
  Command.withDescription(
    "Rebuild the devnet's state from a fork of Base at BASE_FORK_BLOCK (reads BASE_FORK_RPC_URL; run with --env-file)"
  ),
  Command.withHandler(() =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = process.cwd()
      const { forkBlock, forkRpcUrl } = yield* Config.all({
        forkRpcUrl: Config.Redacted("BASE_FORK_RPC_URL"),
        forkBlock: Config.Int("BASE_FORK_BLOCK")
      }).pipe(
        Effect.mapError(() =>
          CheckFailed.make({
            check: "devnet capture",
            problems: ["Set BASE_FORK_RPC_URL and BASE_FORK_BLOCK (pnpm devnet:capture reads them from .env.local)."]
          })
        )
      )

      const helpers = yield* helperCode(root)
      const state = yield* Effect.tryPromise({
        try: () =>
          captureDevnet({
            forkRpcUrl: Redacted.value(forkRpcUrl),
            forkBlock: BigInt(forkBlock),
            helpers,
            log: (message) => console.log(`devnet: ${message}`)
          }),
        catch: (cause) => ToolFailed.make({ tool: "devnet capture", output: String(cause) })
      })

      const file = path.join(root, DEVNET_STATE)
      yield* fs.makeDirectory(path.dirname(file), { recursive: true })
      yield* fs.writeFile(file, state)
      yield* Console.log(
        `devnet: wrote ${DEVNET_STATE} (${Math.round(state.length / 1024)} KB) from block ${forkBlock}`
      )
    })
  )
)

export const devnet = Command.make("devnet").pipe(
  Command.withDescription("The local Base the tests run on"),
  Command.withSubcommands([capture])
)
