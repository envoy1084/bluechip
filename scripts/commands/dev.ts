import { Array as Arr, Console, Effect, Schedule, Stream } from "effect"
import { Command, Flag } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { ToolFailed } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

/** Where each app listens in development. The apps' own defaults match these. */
export const DEV_PORTS = { web: 3000, uikit: 4000, server: 8080 } as const

/** A long-running development process: a workspace package's script, shown under `name`. */
export interface DevProcess {
  readonly name: string
  readonly color: number
  readonly filter: string
  readonly script: string
}

/** The processes `pnpm dev` runs, without the ones switched off. */
export const devProcesses = (options: { readonly uikit: boolean; readonly jobs: boolean }): Array<DevProcess> => [
  { name: "server", color: 34, filter: "@bluechip/server", script: "dev" },
  { name: "web", color: 32, filter: "@bluechip/web", script: "dev" },
  ...(options.uikit ? [{ name: "uikit", color: 35, filter: "@bluechip/uikit", script: "dev" }] : []),
  ...(options.jobs ? [{ name: "jobs", color: 33, filter: "@bluechip/server", script: "jobs:dev" }] : [])
]

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
    ChildProcess.make("pnpm", ["--silent", "--filter", process.filter, process.script], {
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
  yield* Console.log("dev: stopping the fork and the bundler (they read through your RPC)")
  yield* tools.run("docker", ["compose", "--profile", "chain", "stop", "anvil", "alto"]).pipe(Effect.ignore)
})

const up = Effect.fn("dev.up")(
  function*(options: { readonly chain: boolean; readonly uikit: boolean; readonly jobs: boolean }) {
    const tools = yield* Tools

    yield* Console.log(
      options.chain ? "dev: starting Postgres, the Base fork and the bundler" : "dev: starting Postgres"
    )
    yield* tools.run("docker", ["compose", ...(options.chain ? ["--profile", "chain"] : []), "up", "-d", "--wait"], {
      inherit: true
    })
    if (options.chain) {
      yield* Effect.addFinalizer(() => stopFork)
      yield* waitForRpc("anvil", "http://localhost:8545", "eth_chainId")
      yield* waitForRpc("alto", "http://localhost:4337", "eth_supportedEntryPoints")
    }

    yield* tools.run("pnpm", ["--silent", "--filter", "@bluechip/server", "db:migrate"], { inherit: true })

    const processes = devProcesses(options)
    const width = Math.max(...Arr.map(processes, (process) => process.name.length))
    yield* Console.log([
      "dev: running, Ctrl+C stops everything",
      `  web     http://localhost:${DEV_PORTS.web}`,
      ...(options.uikit ? [`  uikit   http://localhost:${DEV_PORTS.uikit}`] : []),
      `  server  http://localhost:${DEV_PORTS.server} (API docs at /api/docs)`
    ].join("\n"))

    // Every process runs until one stops or Ctrl+C interrupts them all; the finalizer then stops the fork.
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

  for (const port of Object.values(DEV_PORTS)) {
    const pids = yield* tools.run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]).pipe(Effect.orElseSucceed(() => ""))
    for (const pid of pids.split("\n").filter((line) => line !== "")) {
      yield* Effect.sync(() => process.kill(Number(pid), "SIGTERM"))
      yield* Console.log(`dev: stopped the process on port ${port}`)
    }
  }

  // The Trigger.dev CLI listens on no port of ours: it's found by its command line.
  yield* tools.run("pkill", ["-f", "trigger.dev/.*dev|trigger dev"]).pipe(Effect.ignore)
  yield* stopFork

  if (options.all) {
    yield* Console.log("dev: stopping Postgres")
    yield* tools.run("docker", ["compose", "stop"]).pipe(Effect.ignore)
  }
})

const upCommand = Command.make("up", {
  chain: Flag.Boolean("no-chain").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Skip the Base fork and the bundler")
  ),
  uikit: Flag.Boolean("no-uikit").pipe(Flag.withDefault(false), Flag.withDescription("Skip the component kit")),
  jobs: Flag.Boolean("no-jobs").pipe(Flag.withDefault(false), Flag.withDescription("Skip the Trigger.dev job runner"))
}).pipe(
  Command.withDescription("Start Postgres, the Base fork, the bundler, the server, the web app, the kit and the jobs"),
  Command.withHandler((flags) => up({ chain: !flags.chain, uikit: !flags.uikit, jobs: !flags.jobs }))
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
