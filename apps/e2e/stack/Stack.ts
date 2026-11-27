// The suite's own bluechip: a fresh database, a devnet (Anvil from the captured state, and Alto), the server and the
// web app, each on a port of its own, so a run never touches `pnpm dev`'s database, chain or ports and needs no RPC.
import { keepClock } from "@bluechip/devnet/Clock"
import { BASE_FEE_WEI, BUNDLER_KEYS, rpc } from "@bluechip/devnet/Controls"
import { type ChildProcess, execFileSync, spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import { parseEnv } from "node:util"
import { gunzipSync } from "node:zlib"
import { createServer, type ViteDevServer } from "vite"
import { alignPrices, keepPricesAligned } from "./prices.ts"

const root = path.resolve(import.meta.dirname, "../../..")

/** Where everything listens: next to `pnpm dev`'s ports (3000, 8080, 8545, 4337), never on them. */
export const PORTS = { web: 13000, server: 18080, anvil: 18545, alto: 14337 } as const

export const urls = {
  web: `http://localhost:${PORTS.web}`,
  server: `http://localhost:${PORTS.server}`,
  anvil: `http://localhost:${PORTS.anvil}`,
  alto: `http://localhost:${PORTS.alto}`
} as const

export const DATABASE = "bluechip_e2e"

/** Where the stack keeps its logs and the chain's unpacked state (git ignores `.data/`). */
export const dataDir = path.join(root, "apps/e2e/.data")

const postgres = (sql: string) =>
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "bluechip", "-d", "postgres", "-c", sql], {
    cwd: root,
    stdio: "pipe"
  })

const assertFree = (port: number) => {
  let pids = ""
  try {
    pids = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim()
  } catch {
    return
  }
  if (pids !== "") throw new Error(`e2e: port ${port} is in use (pid ${pids}); stop what runs there first`)
}

// Set once the stack stops, so processes ending on its signal aren't reported as crashes.
let stopping = false

const start = (name: string, command: string, args: ReadonlyArray<string>, env: Record<string, string> = {}) => {
  const log = fs.openSync(path.join(dataDir, `${name}.log`), "w")
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", log, log]
  })
  child.on("exit", (code) => {
    if (!stopping && code !== null && code !== 0) {
      process.stderr.write(`e2e: ${name} exited with ${code}, see ${dataDir}/${name}.log\n`)
    }
  })
  return child
}

// The stack takes a few seconds to start (the server builds its engine, Alto checks the chain); waiting is a loop
// on the real thing answering, bounded by a deadline.
const waitFor = async (name: string, ready: () => Promise<boolean>, seconds = 120) => {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    if (await ready().catch(() => false)) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`e2e: ${name} didn't start in ${seconds} s, see ${dataDir}/${name}.log`)
}

const answersRpc = (url: string, method: string) => async () => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] })
  })
  return response.ok
}

/**
 * With `BLUECHIP_E2E_LIVE=1`, the server's assistant on Anthropic's models: the key (and model ids, if set) from
 * `apps/server/.env.local`, handed to the server process only.
 */
const liveAssistant = (): Record<string, string> => {
  if (process.env["BLUECHIP_E2E_LIVE"] !== "1") return {}
  const file = path.join(root, "apps/server/.env.local")
  const env = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, "utf8")) : {}
  const key = env["ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"]
  if (key === undefined || key === "") {
    throw new Error("e2e: BLUECHIP_E2E_LIVE=1 needs ANTHROPIC_API_KEY in apps/server/.env.local")
  }
  return {
    BLUECHIP_E2E_LIVE: "1",
    ANTHROPIC_API_KEY: key,
    ...(env["ASSISTANT_MODEL"] === undefined ? {} : { ASSISTANT_MODEL: env["ASSISTANT_MODEL"] }),
    ...(env["ASSISTANT_SMALL_MODEL"] === undefined ? {} : { ASSISTANT_SMALL_MODEL: env["ASSISTANT_SMALL_MODEL"] })
  }
}

/** A running stack; `stop` ends every process it started. */
export interface Stack {
  readonly stop: () => Promise<void>
}

export const startStack = async (): Promise<Stack> => {
  for (const port of Object.values(PORTS)) assertFree(port)
  fs.mkdirSync(dataDir, { recursive: true })

  const children: Array<ChildProcess> = []
  let web: ViteDevServer | undefined
  let stopClock = () => {}
  let stopPrices = () => {}
  const stop = async () => {
    stopping = true
    stopClock()
    stopPrices()
    await web?.close()
    for (const child of children) child.kill("SIGTERM")
    await Promise.all(children.map((child) =>
      child.exitCode !== null || child.signalCode !== null ?
        undefined :
        new Promise((resolve) => child.once("exit", resolve))
    ))
  }

  try {
    // A new database every run: tests make their own users, and nothing is left from the run before.
    execFileSync("docker", ["compose", "up", "-d", "--wait", "postgres"], { cwd: root, stdio: "pipe" })
    postgres(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`)
    postgres(`CREATE DATABASE ${DATABASE} OWNER bluechip`)
    const databaseUrl = `postgres://bluechip:bluechip@localhost:5432/${DATABASE}`
    execFileSync("node", ["apps/server/src/bin/migrate.ts"], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe"
    })

    const state = path.join(dataDir, "devnet.state.json")
    fs.writeFileSync(state, gunzipSync(fs.readFileSync(path.join(root, "packages/devnet/state/devnet.state.gz"))))
    children.push(start("anvil", "anvil", [
      "--hardfork",
      "base:Denim",
      "--chain-id",
      "8453",
      "--port",
      String(PORTS.anvil),
      "--load-state",
      state,
      "--block-base-fee-per-gas",
      String(BASE_FEE_WEI),
      // A block every 2 s, like Base; its clock is kept at the real one below.
      "--block-time",
      "2"
    ]))
    await waitFor("anvil", answersRpc(urls.anvil, "eth_chainId"))

    // Loading the state brings back the capture's clock and base fee: run now, at Base's fee. The chain keeps the real
    // clock (Alto checks operations against it), so on weekends and holidays prices read as paused, as on Base.
    const anvil = rpc(urls.anvil)
    const now = Math.floor(Date.now() / 1000)
    await anvil("anvil_setTime", [now])
    await anvil("anvil_setNextBlockBaseFeePerGas", [`0x${BASE_FEE_WEI.toString(16)}`])
    await anvil("anvil_mine", ["0x1"])
    await alignPrices(anvil, now)
    // An agent's operation is bounded to its latest block's UTC day, and Alto checks that against the real clock: on
    // Base's hardfork Anvil's own clock falls behind.
    stopClock = keepClock(anvil).stop
    stopPrices = keepPricesAligned(anvil).stop

    children.push(start("alto", path.join(root, "packages/devnet/node_modules/.bin/alto"), [
      "--rpc-url",
      urls.anvil,
      "--entrypoints",
      // EntryPoint v0.7.
      "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      "--executor-private-keys",
      BUNDLER_KEYS.executor,
      "--utility-private-key",
      BUNDLER_KEYS.utility,
      "--port",
      String(PORTS.alto),
      "--safe-mode",
      "true",
      "--bundle-mode",
      "auto",
      "--max-bundle-wait",
      "50",
      "--polling-interval",
      "50",
      "--log-level",
      "warn"
    ]))
    await waitFor("alto", answersRpc(urls.alto, "eth_supportedEntryPoints"))

    children.push(start("server", "node", ["apps/server/test/stack/main.ts"], {
      NODE_ENV: "development",
      PORT: String(PORTS.server),
      PUBLIC_ORIGIN: urls.web,
      RP_ID: "localhost",
      LOG_LEVEL: "Info",
      DATABASE_URL: databaseUrl,
      AGENT_KEY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      NETWORK: "local",
      BASE_RPC_URL: urls.anvil,
      BUNDLER: "local",
      BUNDLER_URL: urls.alto,
      GAS_SPONSORSHIP: "none",
      ASSISTANT_DAILY_BUDGET: "1",
      ...liveAssistant()
    }))
    await waitFor("server", async () => (await fetch(`${urls.server}/health`)).ok)

    // The web app reads these through Vite, ahead of its own `.env.local`.
    process.env["SERVER_ORIGIN"] = urls.server
    process.env["VITE_NETWORK"] = "local"
    // The server's paths on the web app's origin, through Vite's proxy, whatever `.env.local` says.
    process.env["VITE_API_URL"] = ""
    web = await createServer({
      configFile: path.join(root, "apps/web/vite.config.ts"),
      root: path.join(root, "apps/web"),
      // Its own optimizer cache, so a `pnpm dev` running alongside keeps its own.
      cacheDir: path.join(dataDir, "vite"),
      server: { port: PORTS.web, strictPort: true, hmr: false },
      logLevel: "warn"
    })
    await web.listen()
    return { stop }
  } catch (error) {
    await stop()
    throw error
  }
}
