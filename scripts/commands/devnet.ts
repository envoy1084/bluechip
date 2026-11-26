import { rpc } from "@bluechip/devnet/Controls"
import { Config, Console, Effect, FileSystem, Path, Redacted, Schema } from "effect"
import { Command } from "effect/cli"
import { gunzipSync } from "node:zlib"
import { Instance } from "prool"
import type { Hex } from "viem"

import { deployContracts } from "../contracts/deploy.ts"
import { captureDevnet } from "../devnet/capture.ts"
import { CheckFailed, ToolFailed } from "../errors.ts"
import { Tools } from "../services/Tools.ts"
import { builtContracts } from "./contracts.ts"

/** Where the captured state lives: loaded by every devnet test worker. */
export const DEVNET_STATE = "packages/devnet/state/devnet.state.gz"

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

      // The devnet's helper contracts, built, and their runtime bytecode.
      const helperContracts = path.join(root, "packages/devnet/contracts")
      yield* (yield* Tools).run("forge", ["build", "--quiet"], { cwd: helperContracts })
      const runtime = Effect.fnUntraced(function*(name: string) {
        const text = yield* fs.readFileString(path.join(helperContracts, "out", `${name}.sol`, `${name}.json`))
        const artifact = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(Schema.Struct({ deployedBytecode: Schema.Struct({ object: Schema.String }) }))
        )(text)
        return artifact.deployedBytecode.object as Hex
      }, Effect.orDie)
      const helpers = { mockFeed: yield* runtime("MockFeed"), poolSeeder: yield* runtime("PoolSeeder") }
      yield* (yield* Tools).run("forge", ["build", "--quiet"], { cwd: path.join(root, "contracts") })
      const policies = (yield* builtContracts(root)).map(({ address, initCode, spec }) => ({
        label: spec.label,
        address,
        initCode
      }))
      const state = yield* Effect.tryPromise({
        try: () =>
          captureDevnet({
            forkRpcUrl: Redacted.value(forkRpcUrl),
            forkBlock: BigInt(forkBlock),
            helpers,
            policies,
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

const deploy = Command.make("deploy").pipe(
  Command.withDescription(
    "Add bluechip's contracts missing from the devnet's state, deployed as the capture deploys them (no fork, no RPC)"
  ),
  Command.withHandler(() =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = process.cwd()
      const file = path.join(root, DEVNET_STATE)

      yield* (yield* Tools).run("forge", ["build", "--quiet"], { cwd: path.join(root, "contracts") })
      const built = yield* builtContracts(root)
      const loaded = path.join(yield* fs.makeTempDirectoryScoped(), "state.json")
      yield* fs.writeFile(loaded, gunzipSync(yield* fs.readFile(file)))

      // The same chain as the capture's bare Anvil, started from the captured state.
      const anvil = Instance.anvil({ hardfork: "base:Denim" as never, chainId: 8453, loadState: loaded, port: 18_649 })
      const { deployments, state } = yield* Effect.acquireUseRelease(
        Effect.promise(() => anvil.start()),
        () =>
          Effect.tryPromise({
            try: async () => {
              const node = rpc("http://localhost:18649")
              const deployments = await deployContracts(node, built)
              const dump = await node("anvil_dumpState") as Hex
              return { deployments, state: Buffer.from(dump.slice(2), "hex") }
            },
            catch: (cause) => ToolFailed.make({ tool: "devnet deploy", output: String(cause) })
          }),
        () => Effect.promise(() => anvil.stop())
      )

      for (const { address, name, status } of deployments) yield* Console.log(`devnet: ${name} ${address} ${status}`)
      if (deployments.every((deployment) => deployment.status === "present")) return
      yield* fs.writeFile(file, state)
      yield* Console.log(`devnet: wrote ${DEVNET_STATE} (${Math.round(state.length / 1024)} KB)`)
    }).pipe(Effect.scoped)
  )
)

export const devnet = Command.make("devnet").pipe(
  Command.withDescription("The local Base the tests run on"),
  Command.withSubcommands([capture, deploy])
)
