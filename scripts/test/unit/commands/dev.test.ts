import { assert, describe, it } from "@effect/vitest"

import { devProcesses, localChainProcesses, prefixLine } from "../../../commands/dev.ts"

describe("devProcesses", () => {
  it("the server, the web app and the kit", () => {
    assert.deepStrictEqual(devProcesses({ uikit: true }).map((process) => process.name), ["server", "web", "uikit"])
  })

  it("without the kit", () => {
    assert.deepStrictEqual(devProcesses({ uikit: false }).map((process) => process.name), ["server", "web"])
  })

  it("each app is its package's script", () => {
    assert.deepStrictEqual(devProcesses({ uikit: false })[0], {
      name: "server",
      color: 34,
      command: "pnpm",
      args: ["--silent", "--filter", "@bluechip/server", "dev"]
    })
  })
})

describe("localChainProcesses", () => {
  const chain = localChainProcesses({ stateFile: "/repo/.data/devnet/state.json", alto: "/repo/alto" })

  it("Anvil on Base's hardfork and chain id, keeping its state in the file", () => {
    assert.deepStrictEqual(chain.anvil.args, [
      "--hardfork",
      "base:Denim",
      "--chain-id",
      "8453",
      "--port",
      "8545",
      "--state",
      "/repo/.data/devnet/state.json",
      "--block-base-fee-per-gas",
      "10000000",
      "--silent"
    ])
  })

  it("Alto on that chain, in safe mode, bundling as operations arrive", () => {
    assert.deepStrictEqual(chain.alto.args.slice(0, 4), [
      "--rpc-url",
      "http://localhost:8545",
      "--entrypoints",
      "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    ])
    assert.deepStrictEqual(chain.alto.args.slice(8), [
      "--port",
      "4337",
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
    ])
  })
})

describe("prefixLine", () => {
  it("a line under its process's name, padded to the widest name", () => {
    const [server] = devProcesses({ uikit: false })
    assert.strictEqual(prefixLine(server!, 7, "ready"), "\u001b[34mserver  │\u001b[0m ready")
  })
})
