// What `contracts build` hands the TypeScript side: each contract's ABI, its constructor arguments and init code,
// and its deterministic address (CREATE2 through the Arachnid deployer, salt `keccak256("bluechip.<name>")`), the
// same on every chain where the constructor arguments match (all of Base's).
import { baseDeployment } from "@bluechip/chain/deployments/Base"
import { type Abi, type Address, encodeAbiParameters, getContractAddress, type Hex, keccak256, toHex } from "viem"

/** The deterministic deployment proxy every chain (and Anvil) has, which Namera deploys through too. */
export const CREATE2_DEPLOYER: Address = "0x4e59b44847b379578588920cA78FbF26c0B4956C"

/** Chainlink's L2 sequencer uptime feed on Base. */
export const SEQUENCER_FEED: Address = "0xBCF85224fc0756B9Fa45aA7892530B47e10b6433"

/** How long after Base's sequencer comes back prices aren't trusted: Chainlink's recommendation. */
export const SEQUENCER_GRACE_SECONDS = 3600

/** The rules `TradeGuard` runs, each its own contract with no constructor arguments. */
export const RULES = [
  "TradeSizeRule",
  "FairPriceRule",
  "StockCapRule",
  "CashReserveRule",
  "RebalanceRule",
  "StopLossFloorRule",
  "SlippageBudgetRule"
] as const

/** A contract bluechip deploys: its label, Foundry artifact, and constructor arguments. */
export interface ContractSpec {
  readonly name: "AerodromeTradePolicy" | "TradeGuard" | "RecoveryDelayPolicy" | typeof RULES[number]
  readonly label: string
  readonly constructorTypes: ReadonlyArray<{ readonly type: string }>
  readonly constructorArgs: ReadonlyArray<unknown>
}

export const CONTRACTS: ReadonlyArray<ContractSpec> = [
  {
    name: "AerodromeTradePolicy",
    label: "bluechip.aerodrome-trade-policy",
    constructorTypes: [{ type: "address" }, { type: "address" }],
    constructorArgs: [baseDeployment.usdc, baseDeployment.exchange.router]
  },
  {
    name: "TradeGuard",
    label: "bluechip.trade-guard",
    constructorTypes: [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    constructorArgs: [baseDeployment.usdc, SEQUENCER_FEED, BigInt(SEQUENCER_GRACE_SECONDS)]
  },
  {
    name: "RecoveryDelayPolicy",
    label: "bluechip.recovery-delay-policy",
    constructorTypes: [],
    constructorArgs: []
  },
  // `TradeSizeRule` → `bluechip.trade-size-rule`.
  ...RULES.map((name) => ({
    name,
    label: `bluechip.${name.replace(/[A-Z]/g, (letter, at) => `${at === 0 ? "" : "-"}${letter.toLowerCase()}`)}`,
    constructorTypes: [],
    constructorArgs: []
  }))
]

/** A contract's salt: its label, hashed. */
export const saltOf = (label: string): Hex => keccak256(toHex(label))

/** A contract's init code: its creation bytecode followed by its encoded constructor arguments. */
export const initCodeOf = (spec: ContractSpec, bytecode: Hex): Hex =>
  `${bytecode}${encodeAbiParameters(spec.constructorTypes as never, spec.constructorArgs as never).slice(2)}`

/** Where CREATE2 through the deployer puts a contract with `initCode`. */
export const addressOf = (spec: ContractSpec, initCode: Hex): Address =>
  getContractAddress({ opcode: "CREATE2", from: CREATE2_DEPLOYER, salt: saltOf(spec.label), bytecode: initCode })

/** The generated TypeScript module of each contract's ABI and address, for `packages/chain/src/policies/Deployed.ts`. */
export const deployedModule = (
  contracts: ReadonlyArray<{ readonly spec: ContractSpec; readonly abi: Abi; readonly address: Address }>
): string => {
  const exports = contracts.map(({ abi, address, spec }) => {
    const name = spec.name[0]!.toLowerCase() + spec.name.slice(1)
    return [
      `/**\n * \`${spec.name}\` (\`${spec.label}\`): its address on Base and the devnet.\n *\n * @stability unstable\n * @category contracts\n * @since 0.0.0\n */`,
      `export const ${name}: Address = "${address}"`,
      "",
      `/**\n * \`${spec.name}\`'s ABI.\n *\n * @stability unstable\n * @category abis\n * @since 0.0.0\n */`,
      `export const ${name}Abi = ${JSON.stringify(abi)} as const`
    ].join("\n")
  })
  return [
    "/**",
    " * bluechip's onchain policies: their addresses and ABIs. Written by `node scripts/bin.ts contracts build` from the",
    " * Foundry build in `contracts/`; do not edit.",
    " *",
    " * @since 0.0.0",
    " */",
    "import type { Address } from \"viem\"",
    "",
    exports.join("\n\n"),
    ""
  ].join("\n")
}
