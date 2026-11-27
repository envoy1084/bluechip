// Deploys bluechip's policies to a local Anvil chain (the devnet or a fork of Base) the way they will deploy on Base:
// CREATE2 through the deterministic deployer, so each lands at the address `contracts build` wrote. Base itself waits
// until the policies are complete and audited, so any other chain is refused.
import { DEVNET_ADMIN, type Rpc } from "@bluechip/devnet/Controls"
import type { Address, Hex } from "viem"

import { type ContractSpec, CREATE2_DEPLOYER, saltOf } from "./artifacts.ts"

/** A contract ready to deploy: its spec, init code and the address CREATE2 gives it. */
interface Deployable {
  readonly spec: ContractSpec
  readonly initCode: Hex
  readonly address: Address
}

/** Whether a contract's code is at its address: `deployed` by this run, or already `present`. */
export interface Deployment {
  readonly name: ContractSpec["name"]
  readonly address: Address
  readonly status: "deployed" | "present" | "missing"
}

const hasCode = async (node: Rpc, address: Address) => (await node("eth_getCode", [address, "latest"])) !== "0x"

/** Where each contract stands on the chain at `node`. */
export const contractStatus = async (node: Rpc, contracts: ReadonlyArray<Deployable>) => {
  const statuses: Array<Deployment> = []
  for (const { address, spec } of contracts) {
    statuses.push({ name: spec.name, address, status: await hasCode(node, address) ? "present" : "missing" })
  }
  return statuses
}

/** Deploys each contract not yet at its address, from Anvil's first unlocked account, and checks it landed there. */
export const deployContracts = async (node: Rpc, contracts: ReadonlyArray<Deployable>) => {
  // Anvil answers `anvil_nodeInfo`; a public node doesn't.
  const anvil = await node("anvil_nodeInfo").then(() => true, () => false)
  if (!anvil) throw new Error("contracts: only a local Anvil chain (the devnet or a fork) can be deployed to")

  const deployments: Array<Deployment> = []
  for (const { address, initCode, spec } of contracts) {
    if (await hasCode(node, address)) {
      deployments.push({ name: spec.name, address, status: "present" })
      continue
    }

    const data = `${saltOf(spec.label)}${initCode.slice(2)}`
    const hash = await node("eth_sendTransaction", [{ from: DEVNET_ADMIN, to: CREATE2_DEPLOYER, data }])
    // Anvil answers before automine has the block.
    while ((await node("eth_getTransactionReceipt", [hash])) === null);
    if (!(await hasCode(node, address))) throw new Error(`contracts: ${spec.name} didn't land at ${address}`)
    deployments.push({ name: spec.name, address, status: "deployed" })
  }
  return deployments
}
