import { baseDeployment } from "@bluechip/chain/deployments/Base"
import { type Rpc, rpc } from "@bluechip/devnet/Controls"
import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { Command, Flag } from "effect/cli"
import { parseEnv } from "node:util"
import { type Abi, createPublicClient, createWalletClient, formatEther, type Hex, http, publicActions } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia } from "viem/chains"

import { addressOf, CONTRACTS, type ContractSpec, deployedModule, initCodeOf } from "../contracts/artifacts.ts"
import { contractStatus, deployContracts, type Deployment } from "../contracts/deploy.ts"
import { deployPaper, sepoliaModule } from "../contracts/paper.ts"
import { seedPrices } from "../contracts/paperPrices.ts"
import { CheckFailed, SetupError, ToolFailed } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

/** Where the generated addresses and ABIs go. */
export const DEPLOYED_MODULE = "packages/chain/src/policies/Deployed.ts"

/** Where `contracts deploy --network sepolia` writes paper's addresses. */
export const SEPOLIA_MODULE = "packages/chain/src/deployments/Sepolia.ts"

/** Paper's server environment: its Base Sepolia RPC, the operator's key, Alpaca's and BaseScan's keys (never printed). */
export const PAPER_ENV = "deploy/.env.paper"

/** The paper contracts' Foundry artifacts, deployed besides bluechip's policies (`contracts/src/paper/`). */
const PAPER_ARTIFACTS = [
  "TestUsdc",
  "TestStock",
  "PaperFeed",
  "PaperFeedWriter",
  "SequencerUptimeStub",
  "PaperFactory",
  "PaperRouter",
  "PaperQuoter"
] as const

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

const network = Flag.Literals("network", ["local", "sepolia"]).pipe(
  Flag.withDefault("local"),
  Flag.withDescription(`local: an Anvil chain at --rpc-url; sepolia: paper on Base Sepolia, from ${PAPER_ENV}`)
)

/** Paper on Base Sepolia: the operator deploys what's missing, then `SEPOLIA_MODULE` is written. */
const deploySepolia = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = process.cwd()

  const env = parseEnv(yield* fs.readFileString(path.join(root, PAPER_ENV)).pipe(Effect.orDie))
  const rpcUrl = env["BASE_RPC_URL"]
  const key = env["OPERATOR_PRIVATE_KEY"]
  if (rpcUrl === undefined || key === undefined) {
    return yield* SetupError.make({ message: `${PAPER_ENV} needs BASE_RPC_URL and OPERATOR_PRIVATE_KEY` })
  }
  const keyId = env["ALPACA_API_KEY_ID"]
  const secret = env["ALPACA_API_SECRET_KEY"]

  const bytecode = Object.fromEntries(
    yield* Effect.forEach(
      [...PAPER_ARTIFACTS, ...CONTRACTS.map((spec) => spec.name)],
      (name) => Effect.map(readArtifact(root, name), ({ bytecode }) => [name, bytecode] as const)
    )
  )
  const client = createWalletClient({
    account: privateKeyToAccount(key as Hex),
    chain: baseSepolia,
    transport: http(rpcUrl)
  }).extend(publicActions)

  const run = Effect.tryPromise({
    try: async () => {
      const seeds = await seedPrices(
        baseDeployment.stocks.map((stock) => ({ symbol: stock.symbol, baseFeed: stock.feed })),
        {
          alpaca: keyId === undefined || secret === undefined ? undefined : { keyId, secret },
          base: createPublicClient({ chain: base, transport: http() })
        }
      )
      const before = await client.getBalance({ address: client.account.address })
      const deployed = await deployPaper(
        client,
        bytecode,
        baseDeployment.stocks.map((stock) => ({
          symbol: stock.symbol,
          name: stock.name,
          price: seeds.prices.get(stock.symbol)!.price
        }))
      )
      const after = await client.getBalance({ address: client.account.address })
      return { ...deployed, seeds, spent: before - after, balance: after }
    },
    // viem's errors quote the RPC URL, which carries the provider's key.
    catch: (cause) =>
      ToolFailed.make({ tool: "contracts deploy --network sepolia", output: String(cause).replaceAll(rpcUrl, "<rpc>") })
  })
  const { addresses, balance, seeds, spent, steps } = yield* run

  if (seeds.alpacaFailure !== undefined) yield* Console.log(`contracts: Alpaca gave no prices (${seeds.alpacaFailure})`)
  for (const [symbol, { price, source }] of seeds.prices) {
    yield* Console.log(`contracts: seed price ${symbol} ${Number(price) / 1e8} (${source})`)
  }
  for (const step of steps) yield* Console.log(`contracts: ${step.name} ${step.address} ${step.status}`)
  yield* Console.log(`contracts: spent ${formatEther(spent)} ETH, ${formatEther(balance)} ETH left`)

  yield* fs.writeFileString(path.join(root, SEPOLIA_MODULE), sepoliaModule(addresses)).pipe(Effect.orDie)
  yield* (yield* Tools).run("pnpm", ["exec", "dprint", "fmt", SEPOLIA_MODULE])
  yield* Console.log(`contracts: wrote ${SEPOLIA_MODULE}`)

  const apiKey = env["BASESCAN_API_KEY"]
  if (apiKey === undefined) return yield* Console.log("contracts: source verification skipped (no BASESCAN_API_KEY)")
  // Etherscan's API (v2, one key for every chain) verifies BaseScan's; forge reads the key from its environment, so it
  // never appears in a command line, and skips a contract verified before. BaseScan's queue can take minutes.
  const unverified: Array<string> = []
  for (const step of steps) {
    if (step.source === undefined) continue
    const verified = yield* (yield* Tools).run("forge", [
      "verify-contract",
      step.address,
      step.source.artifact,
      "--chain",
      String(baseSepolia.id),
      "--verifier",
      "etherscan",
      "--constructor-args",
      step.source.constructorArgs,
      "--watch",
      "--retries",
      "30",
      "--delay",
      "10"
    ], { cwd: path.join(root, "contracts"), env: { ETHERSCAN_API_KEY: apiKey } }).pipe(
      Effect.as(true),
      Effect.catchTag("ToolFailed", () => Effect.succeed(false))
    )
    if (!verified) unverified.push(step.name)
    const link = `https://sepolia.basescan.org/address/${step.address}#code`
    yield* Console.log(`contracts: ${verified ? "verified" : "not verified"} ${step.name} ${link}`)
  }
  if (unverified.length > 0) {
    return yield* CheckFailed.make({
      check: "contracts verify",
      problems: unverified.map((name) => `${name} isn't verified`)
    })
  }
})

const deploy = Command.make("deploy", { network, rpcUrl }).pipe(
  Command.withDescription(
    "Deploy the built contracts: to a local Anvil chain at their CREATE2 addresses, or paper's to Base Sepolia"
  ),
  Command.withHandler(({ network, rpcUrl }) =>
    Effect.gen(function*() {
      yield* installDependencies
      yield* forge(["build", "--quiet"])
      if (network === "sepolia") return yield* deploySepolia
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
