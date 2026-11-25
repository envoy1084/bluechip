import { rpc } from "@bluechip/devnet/Controls"
import { NodeServices } from "@effect/platform-node"
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Instance } from "prool"

import { builtContracts } from "../commands/contracts.ts"
import { contractStatus, deployContracts } from "../contracts/deploy.ts"

// A fresh Anvil, empty but for the deterministic deployer it has at genesis, as Base has.
const anvil = Instance.anvil({ chainId: 8453, port: 18_648 })
const node = rpc("http://localhost:18648")

beforeAll(() => anvil.start())
afterAll(() => anvil.stop())

const built = () => Effect.runPromise(builtContracts(process.cwd()).pipe(Effect.provide(NodeServices.layer)))

describe("deployContracts", () => {
  it("deploys each contract at the address `contracts build` wrote, once", async () => {
    const contracts = await built()

    const first = await deployContracts(node, contracts)
    const second = await deployContracts(node, contracts)

    assert.deepStrictEqual(first, [
      { name: "AerodromeTradePolicy", address: "0x6a8Ff74F0D94dB667CcdeA596a4B2DA796Da1E55", status: "deployed" },
      { name: "TradeGuard", address: "0x9246C1e5448Cc76685a21BD4e9f56a449E9b9BdD", status: "deployed" }
    ])
    assert.deepStrictEqual(second.map((deployment) => deployment.status), ["present", "present"])
    assert.deepStrictEqual((await contractStatus(node, contracts)).map((deployment) => deployment.status), [
      "present",
      "present"
    ])
  })

  it("refuses a node that isn't Anvil", async () => {
    const failure = await deployContracts(async (method) => {
      if (method === "anvil_nodeInfo") throw new Error("method not found")
      return "0x"
    }, await built()).then(() => undefined, (error: Error) => error.message)

    assert.strictEqual(failure, "contracts: only a local Anvil chain (the devnet or a fork) can be deployed to")
  })
})
