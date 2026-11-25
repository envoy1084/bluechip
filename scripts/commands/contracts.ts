import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { Command } from "effect/cli"
import type { Abi, Hex } from "viem"

import { addressOf, CONTRACTS, type ContractSpec, deployedModule, initCodeOf } from "../contracts/artifacts.ts"
import { contractVectors } from "../contracts/vectors.ts"
import { Tools } from "../services/Tools.ts"

/** Where the generated addresses and ABIs go. */
export const DEPLOYED_MODULE = "packages/chain/src/agents/Deployed.ts"

const Artifact = Schema.Struct({
  abi: Schema.Array(Schema.Unknown),
  bytecode: Schema.Struct({ object: Schema.String })
})

const forge = Effect.fnUntraced(function*(args: ReadonlyArray<string>) {
  const path = yield* Path.Path
  yield* (yield* Tools).run("forge", args, { cwd: path.join(process.cwd(), "contracts"), inherit: true })
})

/** A contract's Foundry artifact: its ABI and creation bytecode. */
export const readArtifact = Effect.fn("contracts.readArtifact")(function*(root: string, name: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const text = yield* fs.readFileString(path.join(root, "contracts", "out", `${name}.sol`, `${name}.json`))
  const artifact = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Artifact))(text)
  return { abi: artifact.abi as Abi, bytecode: artifact.bytecode.object as Hex }
}, Effect.orDie)

/** Each contract with its ABI (TradeGuard's with the rule errors it reverts with), init code and address. */
export const builtContracts = Effect.fn("contracts.builtContracts")(function*(root: string) {
  const rules = yield* readArtifact(root, "GuardRules")
  return yield* Effect.forEach(
    CONTRACTS,
    (spec: ContractSpec) =>
      Effect.map(readArtifact(root, spec.name), ({ abi, bytecode }) => {
        const initCode = initCodeOf(spec, bytecode)
        const errors = spec.name === "TradeGuard" ? rules.abi.filter((item) => item.type === "error") : []
        return { spec, abi: [...abi, ...errors] as Abi, initCode, address: addressOf(spec, initCode) }
      })
  )
})

const build = Command.make("build").pipe(
  Command.withDescription(`Build the contracts and write their addresses and ABIs to ${DEPLOYED_MODULE}`),
  Command.withHandler(() =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      yield* forge(["build", "--quiet"])

      const contracts = yield* builtContracts(process.cwd())
      yield* fs.writeFileString(path.join(process.cwd(), DEPLOYED_MODULE), deployedModule(contracts))
      yield* (yield* Tools).run("pnpm", ["exec", "dprint", "fmt", DEPLOYED_MODULE])
      for (const { address, spec } of contracts) yield* Console.log(`contracts: ${spec.name} ${address}`)
    })
  )
)

/** Installs the Soldeer dependencies (`soldeer.lock` pins them) when a fresh checkout doesn't have them yet. */
const installDependencies = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  if (yield* fs.exists(path.join(process.cwd(), "contracts", "dependencies"))) return
  yield* forge(["soldeer", "install"])
}).pipe(Effect.orDie)

const test = Command.make("test").pipe(
  Command.withDescription("Run the contracts' Foundry tests (unit, fuzz and the shared vectors)"),
  Command.withHandler(() => installDependencies.pipe(Effect.andThen(forge(["test"]))))
)

const snapshot = Command.make("snapshot").pipe(
  Command.withDescription("Write the contracts' gas snapshot (contracts/.gas-snapshot)"),
  Command.withHandler(() => forge(["snapshot"]))
)

const vectors = Command.make("vectors").pipe(
  Command.withDescription("Export the shared agent-rule vectors to contracts/test/vectors.json"),
  Command.withHandler(() =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const data = contractVectors()
      yield* fs.writeFileString(
        path.join(process.cwd(), "contracts", "test", "vectors.json"),
        `${JSON.stringify(data, null, 2)}\n`
      )
      yield* Console.log(`contracts: ${data.guard.length} guard and ${data.shape.length} shape vectors`)
    })
  )
)

export const contracts = Command.make("contracts").pipe(
  Command.withDescription("bluechip's onchain policies (Foundry, in contracts/)"),
  Command.withSubcommands([build, test, snapshot, vectors])
)
