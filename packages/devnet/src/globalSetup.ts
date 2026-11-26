/**
 * The Vitest global setup that serves the devnet: one Anvil and one Alto per test worker, each Anvil started from
 * the captured state (`state/devnet.state.gz`), so a worker's chain is ready without installing anything. The unpacked
 * state is provided too, for files that start a devnet of their own (`DevnetTest.layerIsolated`).
 *
 * @since 0.0.0
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { gunzipSync } from "node:zlib"
import { Server } from "prool/vitest"
import { contextKey, type DevnetContext, stateKey } from "./Devnet.ts"
import * as Instances from "./internal/instances.ts"

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
  // Anvil loads a state file, not the gzipped dump: unpack it once per run, where every worker's Anvil can read it.
  const packed = path.join(import.meta.dirname, "..", "state", "devnet.state.gz")
  const state = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bluechip-devnet-")), "state.json")
  fs.writeFileSync(state, gunzipSync(fs.readFileSync(packed)))
  let anvilUrl = ""

  return Server.setup({
    instances: {
      anvil: Instances.anvil(state),
      alto: (poolId: number) => Instances.alto(`${anvilUrl}/${poolId}`)
    },
    setup(context: DevnetContext, project: { provide: (key: string, value: unknown) => void }) {
      anvilUrl = context.anvil.url
      project.provide(contextKey, context)
      project.provide(stateKey, state)
    }
  })
}
