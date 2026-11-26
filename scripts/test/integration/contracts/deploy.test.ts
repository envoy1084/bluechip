import { rpc } from "@bluechip/devnet/Controls"
import { NodeServices } from "@effect/platform-node"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Instance } from "prool"

import { builtContracts } from "../../../commands/contracts.ts"
import { contractStatus, deployContracts } from "../../../contracts/deploy.ts"

// A fresh Anvil, empty but for the deterministic deployer it has at genesis, as Base has.
const anvil = Instance.anvil({ chainId: 8453, port: 18_648 })
const node = rpc("http://localhost:18648")

const FreshAnvil = Layer.effectDiscard(
  Effect.acquireRelease(Effect.promise(() => anvil.start()), () => Effect.promise(() => anvil.stop()))
)

layer(Layer.merge(NodeServices.layer, FreshAnvil))("deployContracts", (it) => {
  it.effect("deploys each contract at the address `contracts build` wrote, once", () =>
    Effect.gen(function*() {
      const contracts = yield* builtContracts(process.cwd())

      const first = yield* Effect.promise(() => deployContracts(node, contracts))
      const second = yield* Effect.promise(() => deployContracts(node, contracts))
      const status = yield* Effect.promise(() => contractStatus(node, contracts))

      assert.deepStrictEqual(first, [
        { name: "AerodromeTradePolicy", address: "0x3FdF29585d00d26240da3c45168Cad0148Ac9073", status: "deployed" },
        { name: "TradeGuard", address: "0x6131C37391279FFD3831dB2F89C10C29D52fc57D", status: "deployed" },
        { name: "TradeSizeRule", address: "0x240274AB59bd003C39eDf22542910EA9BBc3121e", status: "deployed" },
        { name: "FairPriceRule", address: "0x8482F4E90a5101422044e1D54D45AF72A75d28e3", status: "deployed" },
        { name: "StockCapRule", address: "0x6Ec294E0c7D091E57c67Cf4dE4f0965170Ff61DA", status: "deployed" },
        { name: "CashReserveRule", address: "0x1A9aB2684e08C8fAd79D6014eeeFe874AC67E701", status: "deployed" },
        { name: "RebalanceRule", address: "0xf7859d6DC9265D229F4F38e3d022bAf6a02B923E", status: "deployed" },
        { name: "StopLossFloorRule", address: "0x40303065601832aED92bB4fad1d6425631ddD47e", status: "deployed" },
        { name: "SlippageBudgetRule", address: "0x1167EC36224BCd2FAce8502Bc7284a84b01bef4E", status: "deployed" }
      ])
      assert.deepStrictEqual(second.map((deployment) => deployment.status), Array(9).fill("present"))
      assert.deepStrictEqual(status.map((deployment) => deployment.status), Array(9).fill("present"))
    }))

  it.effect("refuses a node that isn't Anvil", () =>
    Effect.gen(function*() {
      const contracts = yield* builtContracts(process.cwd())

      const failure = yield* Effect.tryPromise({
        try: () =>
          deployContracts(async (method) => {
            if (method === "anvil_nodeInfo") throw new Error("method not found")
            return "0x"
          }, contracts),
        catch: (error) => (error as Error).message
      }).pipe(Effect.flip)

      assert.strictEqual(failure, "contracts: only a local Anvil chain (the devnet or a fork) can be deployed to")
    }))
})
