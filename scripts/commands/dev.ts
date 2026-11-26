import { BASE_FEE_WEI, BUNDLER_KEYS, rpc } from "@bluechip/devnet/Controls"
import { Array as Arr, Console, Effect, FileSystem, Path, Schedule, Stream } from "effect"
import { Command, Flag } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { gunzipSync } from "node:zlib"

import { deployContracts } from "../contracts/deploy.ts"
import { syncPrices } from "../devnet/sync.ts"
import { ToolFailed } from "../errors.ts"
import { Tools } from "../services/Tools.ts"
import { builtContracts } from "./contracts.ts"
import { DEVNET_STATE } from "./devnet.ts"

/** Where each app listens in development. The apps' own defaults match these. */
export const DEV_PORTS = { web: 3000, uikit: 4000, server: 8080 } as const

/** Where the local chain listens: the server's defaults (`BASE_RPC_URL`, `BUNDLER_URL`) point here. */
export const CHAIN_PORTS = { anvil: 8545, alto: 4337 } as const

/** Where `pnpm dev`'s local chain keeps its state between runs (`--reset-chain` starts it again from the capture). */
export const LOCAL_CHAIN_STATE = ".data/devnet/state.json"

/** A long-running development process, shown under `name`. */
export interface DevProcess {
  readonly name: string
  readonly color: number
  readonly command: string
  readonly args: ReadonlyArray<string>
}

const script = (name: string, color: number, filter: string, run: string): DevProcess => ({
  name,
  color,
  command: "pnpm",
  args: ["--silent", "--filter", filter, run]
})

/** The apps `pnpm dev` runs, without the ones switched off. */
export const devProcesses = (options: { readonly uikit: boolean }): Array<DevProcess> => [
  script("server", 34, "@bluechip/server", "dev"),
  script("web", 32, "@bluechip/web", "dev"),
  ...(options.uikit ? [script("uikit", 35, "@bluechip/uikit", "dev")] : [])
]

/**
 * The local chain: Anvil on Base's latest hardfork, keeping its state in `stateFile` across runs, and Alto in safe
 * mode bundling as soon as an operation arrives.
 *
 * Anvil mines a block every 2 s, like Base: an agent's operation states the latest block's time, and Namera bounds it
 * to that time's UTC day, so a chain idle since yesterday would send operations the bundler rejects as expired.
 */
export const localChainProcesses = (options: { readonly stateFile: string; readonly alto: string }) => ({
  anvil: {
    name: "chain",
    color: 36,
    command: "anvil",
    args: [
      "--hardfork",
      "base:Denim",
      "--chain-id",
      "8453",
      "--port",
      String(CHAIN_PORTS.anvil),
      "--state",
      options.stateFile,
      "--block-base-fee-per-gas",
      String(BASE_FEE_WEI),
      "--block-time",
      "2",
      "--silent"
    ]
  } satisfies DevProcess,
  alto: {
    name: "bundler",
    color: 90,
    command: options.alto,
    args: [
      "--rpc-url",
      `http://localhost:${CHAIN_PORTS.anvil}`,
      "--entrypoints",
      // EntryPoint v0.7.
      "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      "--executor-private-keys",
      BUNDLER_KEYS.executor,
      "--utility-private-key",
      BUNDLER_KEYS.utility,
      "--port",
      String(CHAIN_PORTS.alto),
      "--safe-mode",
      "true",
      "--bundle-mode",
      "auto",
      "--max-bundle-wait",
      "100",
      "--polling-interval",
      "100",
      "--log-level",
      "warn"
    ]
  } satisfies DevProcess
})

/** One output line under its process's name, padded so the lines of every process align. */
export const prefixLine = (process: DevProcess, width: number, line: string): string =>
  `\u001b[${process.color}m${process.name.padEnd(width)} │\u001b[0m ${line}`

/** Waits until `url` answers a JSON-RPC call: the fork and the bundler take a few seconds to start. */
const waitForRpc = (name: string, url: string, method: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] })
      })
      if (!response.ok) throw new Error(`${response.status}`)
    },
    catch: (cause) => ToolFailed.make({ tool: name, output: `${name} didn't start: ${String(cause)}` })
  }).pipe(Effect.retry({ schedule: Schedule.spaced("1 second"), times: 120 }))

/** Starts one process and prints its output under its name until the scope closes, which stops it. */
const runProcess = Effect.fnUntraced(function*(process: DevProcess, width: number) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const handle = yield* spawner.spawn(
    ChildProcess.make(process.command, [...process.args], {
      env: { FORCE_COLOR: "1" },
      extendEnv: true
    })
  )

  yield* handle.all.pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.runForEach((line) => Console.log(prefixLine(process, width, line)))
  )
  const exitCode = yield* handle.exitCode
  yield* Console.log(prefixLine(process, width, `stopped (exit ${exitCode})`))
}, Effect.scoped)

const stopFork = Effect.gen(function*() {
  const tools = yield* Tools
  yield* Console.log("dev: stopping the Base fork and its bundler, if they run (they read through your RPC)")
  yield* tools.run("docker", ["compose", "--profile", "chain", "stop", "anvil", "alto"]).pipe(Effect.ignore)
})

/** Unpacks the captured devnet state for the local chain, unless a previous run's state is kept. */
const prepareLocalChain = Effect.fnUntraced(function*(root: string, reset: boolean) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const stateFile = path.join(root, LOCAL_CHAIN_STATE)
  if (reset || !(yield* fs.exists(stateFile))) {
    yield* fs.makeDirectory(path.dirname(stateFile), { recursive: true })
    yield* fs.writeFile(stateFile, gunzipSync(yield* fs.readFile(path.join(root, DEVNET_STATE))))
  }
  return localChainProcesses({ stateFile, alto: path.join(root, "packages/devnet/node_modules/.bin/alto") })
}, Effect.orDie)

type ChainMode = "local" | "fork" | "none"

const up = Effect.fn("dev.up")(
  function*(options: {
    readonly chain: ChainMode
    readonly resetChain: boolean
    readonly uikit: boolean
  }) {
    const tools = yield* Tools
    const fork = options.chain === "fork"

    yield* Console.log(fork ? "dev: starting Postgres, the Base fork and the bundler" : "dev: starting Postgres")
    yield* tools.run("docker", ["compose", ...(fork ? ["--profile", "chain"] : []), "up", "-d", "--wait"], {
      inherit: true
    })

    const processes = devProcesses(options)
    const chain = options.chain === "local" ? yield* prepareLocalChain(process.cwd(), options.resetChain) : undefined
    const width = Math.max(
      ...Arr.map([...processes, ...(chain ? [chain.anvil, chain.alto] : [])], (p) => p.name.length)
    )

    if (fork) yield* Effect.addFinalizer(() => stopFork)
    if (chain !== undefined) {
      yield* Console.log("dev: starting the local chain (the devnet, no RPC) and the bundler")
      yield* Effect.forkScoped(runProcess(chain.anvil, width))
    }
    if (options.chain !== "none") yield* waitForRpc("anvil", `http://localhost:${CHAIN_PORTS.anvil}`, "eth_chainId")
    if (chain !== undefined) yield* Effect.forkScoped(runProcess(chain.alto, width))
    if (options.chain !== "none") {
      yield* waitForRpc("alto", `http://localhost:${CHAIN_PORTS.alto}`, "eth_supportedEntryPoints")
    }

    // A local chain kept from an earlier run can predate today's contracts (new ones get new CREATE2 addresses):
    // deploy whatever is missing, keeping the rest of its state.
    if (chain !== undefined) {
      yield* Effect.gen(function*() {
        // Loading the kept state brings back its base fee; run at Base's, so agents' gas budgets behave as on Base.
        const anvil = rpc(`http://localhost:${CHAIN_PORTS.anvil}`)
        yield* Effect.tryPromise(async () => {
          await anvil("anvil_setNextBlockBaseFeePerGas", [`0x${BASE_FEE_WEI.toString(16)}`])
          await anvil("anvil_mine", ["0x1"])
        })

        const contracts = yield* builtContracts(process.cwd())
        const deployed = yield* Effect.tryPromise(() => deployContracts(anvil, contracts))
        for (const { name, status } of deployed) {
          if (status === "deployed") yield* Console.log(`dev: deployed ${name}, missing from the local chain`)
        }
      }).pipe(
        Effect.catch((error) =>
          Console.log(
            `dev: couldn't check bluechip's contracts on the local chain (${error}); pnpm dev --reset-chain starts it fresh`
          )
        )
      )
    }

    yield* tools.run("pnpm", ["--silent", "--filter", "@bluechip/server", "db:migrate"], { inherit: true })

    yield* Console.log([
      "dev: running, Ctrl+C stops everything",
      `  web     http://localhost:${DEV_PORTS.web}`,
      ...(options.uikit ? [`  uikit   http://localhost:${DEV_PORTS.uikit}`] : []),
      `  server  http://localhost:${DEV_PORTS.server} (API docs at /api/docs)`,
      ...(chain ? ["  chain   the devnet; prices follow the market every 15 s (--fork for a fork of Base)"] : [])
    ].join("\n"))

    // Keeps the local chain's feeds and pools at the server's market prices; quiet until the server answers.
    if (chain !== undefined) {
      yield* Effect.forkScoped(
        Effect.tryPromise(() =>
          syncPrices({
            apiUrl: `http://localhost:${DEV_PORTS.server}`,
            rpcUrl: `http://localhost:${CHAIN_PORTS.anvil}`
          })
        ).pipe(Effect.ignore, Effect.repeat(Schedule.spaced("15 seconds")))
      )
    }

    // Every process runs until one stops or Ctrl+C interrupts them all; the finalizers then stop the chain.
    yield* Effect.forEach(processes, (process) => runProcess(process, width), {
      concurrency: "unbounded",
      discard: true
    })
  },
  Effect.scoped
)

/** Stops what `pnpm dev` started, if it was left running: the apps on their ports, the job runner and the fork. */
const down = Effect.fn("dev.down")(function*(options: { readonly all: boolean }) {
  const tools = yield* Tools

  // A running `pnpm dev` stops like on Ctrl+C: its processes, then the fork. The sweep below catches leftovers.
  const running = yield* tools.run("pkill", ["-INT", "-f", "node scripts/bin.ts dev up"]).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  )
  if (running) {
    yield* Console.log("dev: asked the running `pnpm dev` to stop")
    yield* Effect.sleep("5 seconds")
  }

  for (const port of [...Object.values(DEV_PORTS), ...Object.values(CHAIN_PORTS)]) {
    const pids = yield* tools.run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]).pipe(Effect.orElseSucceed(() => ""))
    for (const pid of pids.split("\n").filter((line) => line !== "")) {
      yield* Effect.sync(() => process.kill(Number(pid), "SIGTERM"))
      yield* Console.log(`dev: stopped the process on port ${port}`)
    }
  }

  yield* stopFork

  if (options.all) {
    yield* Console.log("dev: stopping Postgres")
    yield* tools.run("docker", ["compose", "stop"]).pipe(Effect.ignore)
  }
})

const upCommand = Command.make("up", {
  chain: Flag.Boolean("no-chain").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Skip the chain and the bundler")
  ),
  fork: Flag.Boolean("fork").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Use a fork of Base (reads through BASE_FORK_RPC_URL) instead of the local devnet")
  ),
  resetChain: Flag.Boolean("reset-chain").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Start the local chain again from the captured devnet state")
  ),
  uikit: Flag.Boolean("no-uikit").pipe(Flag.withDefault(false), Flag.withDescription("Skip the component kit"))
}).pipe(
  Command.withDescription("Start Postgres, the chain, the bundler, the server, the web app and the kit"),
  Command.withHandler((flags) =>
    up({
      chain: flags.chain ? "none" : flags.fork ? "fork" : "local",
      resetChain: flags.resetChain,
      uikit: !flags.uikit
    })
  )
)

const downCommand = Command.make("down", {
  all: Flag.Boolean("all").pipe(Flag.withDefault(false), Flag.withDescription("Stop Postgres too"))
}).pipe(
  Command.withDescription("Stop whatever `dev up` left running, and the fork"),
  Command.withHandler(down)
)

export const dev = Command.make("dev").pipe(
  Command.withDescription("Run the whole development stack, or stop it"),
  Command.withSubcommands([upCommand, downCommand])
)
