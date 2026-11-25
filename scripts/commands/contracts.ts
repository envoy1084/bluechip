import { type Rpc, rpc } from "@bluechip/devnet/Controls"
import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { Command, Flag } from "effect/cli"
import type { Abi, Hex } from "viem"

import { addressOf, CONTRACTS, type ContractSpec, deployedModule, initCodeOf } from "../contracts/artifacts.ts"
import { contractStatus, deployContracts, type Deployment } from "../contracts/deploy.ts"
import { ToolFailed } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

/** Where the generated addresses and ABIs go. */
export const DEPLOYED_MODULE = "packages/chain/src/policies/Deployed.ts"

const forge = Effect.fnUntraced(function*(args: ReadonlyArray<string>) {
  const path = yield* Path.Path
  yield* (yield* Tools).run("forge", args, { cwd: path.join(process.cwd(), "contracts"), inherit: true })
})

/** A contract's Foundry artifact: its ABI and creation bytecode. */
export const readArtifact = Effect.fn("contracts.readArtifact")(function*(root: string, name: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const text = yield* fs.readFileString(path.join(root, "contracts", "out", `${name}.sol`, `${name}.json`))
  const artifact = yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(
      Schema.Struct({ abi: Schema.Array(Schema.Unknown), bytecode: Schema.Struct({ object: Schema.String }) })
    )
  )(text)
  return { abi: artifact.abi as Abi, bytecode: artifact.bytecode.object as Hex }
}, Effect.orDie)

/** Each contract with its ABI (TradeGuard's with the errors of `Outcome`, its checks), init code and address. */
export const builtContracts = Effect.fn("contracts.builtContracts")(function*(root: string) {
  const outcome = yield* readArtifact(root, "Outcome")
  return yield* Effect.forEach(
    CONTRACTS,
    (spec: ContractSpec) =>
      Effect.map(readArtifact(root, spec.name), ({ abi, bytecode }) => {
        const initCode = initCodeOf(spec, bytecode)
        const errors = spec.name === "TradeGuard" ? outcome.abi.filter((item) => item.type === "error") : []
        return { spec, abi: [...abi, ...errors] as Abi, initCode, address: addressOf(spec, initCode) }
      })
  )
})

/** Installs the Soldeer dependencies (`soldeer.lock` pins them) when a fresh checkout doesn't have them yet. */
const installDependencies = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  if (yield* fs.exists(path.join(process.cwd(), "contracts", "dependencies"))) return
  yield* forge(["soldeer", "install"])
}).pipe(Effect.orDie)

const build = Command.make("build").pipe(
  Command.withDescription(`Build the contracts and write their addresses and ABIs to ${DEPLOYED_MODULE}`),
  Command.withHandler(() =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      yield* installDependencies
      yield* forge(["build", "--quiet"])

      const contracts = yield* builtContracts(process.cwd())
      yield* fs.writeFileString(path.join(process.cwd(), DEPLOYED_MODULE), deployedModule(contracts))
      yield* (yield* Tools).run("pnpm", ["exec", "dprint", "fmt", DEPLOYED_MODULE])
      for (const { address, spec } of contracts) yield* Console.log(`contracts: ${spec.name} ${address}`)
    })
  )
)

const test = Command.make("test").pipe(
  Command.withDescription("Check the contracts' formatting and lints, then run their tests (unit, fuzz, vectors)"),
  Command.withHandler(() =>
    Effect.gen(function*() {
      yield* installDependencies
      yield* forge(["fmt", "--check"])
      yield* forge(["lint", "--deny", "warnings"])
      yield* forge(["test"])
    })
  )
)

const snapshot = Command.make("snapshot").pipe(
  Command.withDescription("Write the contracts' gas snapshot (contracts/.gas-snapshot), without the fuzz runs"),
  // Fuzz runs' gas changes with their random inputs, so only the fixed tests are snapshotted.
  Command.withHandler(() => forge(["snapshot", "--no-match-path", "test/Fuzz.t.sol"]))
)

const rpcUrl = Flag.String("rpc-url").pipe(
  Flag.withDefault("http://localhost:8545"),
  Flag.withDescription("The chain's JSON-RPC URL (default: the local chain `pnpm dev` runs)")
)

const onChain = <A>(name: string, run: (node: Rpc) => Promise<A>) => (url: string) =>
  Effect.tryPromise({
    try: () => run(rpc(url)),
    catch: (cause) => ToolFailed.make({ tool: `contracts ${name}`, output: String(cause) })
  })

const report = (deployments: ReadonlyArray<Deployment>) =>
  Effect.forEach(deployments, ({ address, name, status }) => Console.log(`contracts: ${name} ${address} ${status}`), {
    discard: true
  })

const deploy = Command.make("deploy", { rpcUrl }).pipe(
  Command.withDescription("Deploy the built contracts to a local Anvil chain, at their CREATE2 addresses"),
  Command.withHandler(({ rpcUrl }) =>
    Effect.gen(function*() {
      yield* installDependencies
      yield* forge(["build", "--quiet"])
      const built = yield* builtContracts(process.cwd())
      yield* report(yield* onChain("deploy", (node) => deployContracts(node, built))(rpcUrl))
    })
  )
)

const status = Command.make("status", { rpcUrl }).pipe(
  Command.withDescription("Show whether each built contract is at its address on a chain"),
  Command.withHandler(({ rpcUrl }) =>
    Effect.gen(function*() {
      const built = yield* builtContracts(process.cwd())
      yield* report(yield* onChain("status", (node) => contractStatus(node, built))(rpcUrl))
    })
  )
)

export const contracts = Command.make("contracts").pipe(
  Command.withDescription("bluechip's onchain policies (Foundry, in contracts/)"),
  Command.withSubcommands([build, test, snapshot, deploy, status])
)
