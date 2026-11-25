/**
 * The Vitest global setup that serves the devnet: one Anvil and one Alto per test worker, each Anvil started from
 * the captured state (`state/devnet.state.gz`), so a worker's chain is ready without installing anything.
 *
 * @since 0.0.0
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { gunzipSync } from "node:zlib"
import { Instance } from "prool"
import { Server } from "prool/vitest"
import { BUNDLER_KEYS } from "./Controls.ts"
import { contextKey, type DevnetContext } from "./Devnet.ts"

const entryPoint07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

// Anvil loads a state file, not the gzipped dump: unpack it once per run, where every worker's Anvil can read it.
const stateFile = (): string => {
  const packed = path.join(import.meta.dirname, "..", "state", "devnet.state.gz")
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bluechip-devnet-")), "state.json")
  fs.writeFileSync(file, gunzipSync(fs.readFileSync(packed)))
  return file
}

/**
 * A Vitest global setup function: it starts the servers and returns the function that stops them.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type GlobalSetup = (project: {
  readonly config: { readonly maxWorkers: number }
  provide(key: string, value: unknown): void
}) => Promise<() => Promise<void>>

/**
 * Serves the devnet to the project's workers. Use as the default export of a file in Vitest's `globalSetup`.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const globalSetup = (): GlobalSetup => {
  const state = stateFile()
  let anvilUrl = ""

  return Server.setup({
    instances: {
      // Base's latest hardfork runs the B20 precompiles; chain id 8453 so signatures match Base's.
      anvil: Instance.anvil({ hardfork: "base:Denim" as never, chainId: 8453, loadState: state }),
      alto: (poolId: number) =>
        Instance.alto({
          entrypoints: [entryPoint07],
          rpcUrl: `${anvilUrl}/${poolId}`,
          executorPrivateKeys: [BUNDLER_KEYS.executor],
          utilityPrivateKey: BUNDLER_KEYS.utility,
          // Traces every operation's validation against ERC-7562, as the shared mempool does.
          safeMode: true,
          bundleMode: "auto",
          maxBundleWait: 50,
          pollingInterval: 50
        })
    },
    setup(context: DevnetContext, project: { provide: (key: string, value: unknown) => void }) {
      anvilUrl = context.anvil.url
      project.provide(contextKey, context)
    }
  })
}
