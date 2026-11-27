// Paper money on Base Sepolia (`contracts/src/paper/`): test USDC, a test token and feed per stock, the paper exchange
// with Slipstream's interfaces, and bluechip's policies over them, all owned by bluechip's operator. Every contract
// goes through the deterministic deployer, so a run finds what an earlier one placed and only adds what's missing.
import { aggregatorAbi } from "@bluechip/chain/Abis"
import { paperFactoryAbi, paperFeedWriterAbi, paperTokenAbi } from "@bluechip/chain/deployments/PaperAbis"
import {
  type Account,
  type Address,
  encodeAbiParameters,
  getContractAddress,
  type Hex,
  isAddressEqual,
  type PublicActions,
  type Transport,
  type WalletClient,
  zeroAddress
} from "viem"
import type { baseSepolia } from "viem/chains"

import { CONTRACTS, CREATE2_DEPLOYER, saltOf, SEQUENCER_GRACE_SECONDS } from "./artifacts.ts"

/** Base Sepolia's chain id: the only chain paper deploys to. */
export const PAPER_CHAIN_ID = 84_532

/** Every paper pool's tick spacing, as Base's stock pools. */
export const PAPER_TICK_SPACING = 10

/** Every paper pool's fee in pips (0.03%): Base's stock pools charge 0.016% to 0.034% (their dynamic fees). */
export const PAPER_FEE_PIPS = 300

/** The Foundry artifacts paper deploys, by contract name: creation bytecode only. */
type PaperBytecode = Readonly<Record<string, Hex>>

/** A stock to list on paper, and its seed price (8 decimals) for a feed that has none yet. */
interface PaperStock {
  readonly symbol: string
  readonly name: string
  readonly price: bigint
}

/**
 * What a run did with each contract or setting: `deployed` (or set) now, or `present` already. A contract also says
 * its Foundry artifact and encoded constructor arguments, for source verification.
 */
interface PaperStep {
  readonly name: string
  readonly address: Address
  readonly status: "deployed" | "present"
  readonly source?: { readonly artifact: string; readonly constructorArgs: Hex } | undefined
}

/** Every address paper uses, as `packages/chain/src/deployments/Sepolia.ts` exports them. */
interface PaperAddresses {
  readonly usdc: Address
  readonly sequencerFeed: Address
  readonly feedWriter: Address
  readonly operator: Address
  readonly exchange: { readonly factory: Address; readonly router: Address; readonly quoter: Address }
  readonly policies: Readonly<Record<string, Address>>
  readonly stocks: ReadonlyArray<
    { readonly symbol: string; readonly token: Address; readonly feed: Address; readonly pool: Address }
  >
}

/** The operator's client on Base Sepolia: it signs, and reads the chain. */
type OperatorClient =
  & WalletClient<Transport, typeof baseSepolia, Account>
  & PublicActions<Transport, typeof baseSepolia>

/** Deploys (or finds) everything paper needs with the operator's key, and returns its addresses and each step. */
export const deployPaper = async (
  client: OperatorClient,
  bytecode: PaperBytecode,
  stocks: ReadonlyArray<PaperStock>
) => {
  const chainId = await client.getChainId()
  if (chainId !== PAPER_CHAIN_ID) throw new Error(`contracts: paper deploys to Base Sepolia (84532), not ${chainId}`)
  if ((await client.getCode({ address: CREATE2_DEPLOYER })) === undefined) {
    throw new Error(`contracts: the deterministic deployer isn't at ${CREATE2_DEPLOYER}`)
  }

  const operator = client.account.address
  const steps: Array<PaperStep> = []

  const send = async (request: Promise<Hex>) => {
    const receipt = await client.waitForTransactionReceipt({ hash: await request })
    if (receipt.status !== "success") throw new Error(`contracts: transaction ${receipt.transactionHash} reverted`)
  }

  const create2 = async (
    name: string,
    label: string,
    artifact: string,
    types: ReadonlyArray<{ readonly type: string }>,
    args: ReadonlyArray<unknown>
  ) => {
    const creation = bytecode[artifact]
    if (creation === undefined) throw new Error(`contracts: no Foundry artifact for ${artifact}`)
    const constructorArgs = encodeAbiParameters(types as never, args as never)
    const initCode: Hex = `${creation}${constructorArgs.slice(2)}`
    const salt = saltOf(label)
    const address = getContractAddress({ opcode: "CREATE2", from: CREATE2_DEPLOYER, salt, bytecode: initCode })
    const source = { artifact, constructorArgs }

    if ((await client.getCode({ address })) !== undefined) {
      steps.push({ name, address, status: "present", source })
      return address
    }
    await send(client.sendTransaction({ to: CREATE2_DEPLOYER, data: `${salt}${initCode.slice(2)}` }))
    if ((await client.getCode({ address })) === undefined) {
      throw new Error(`contracts: ${name} didn't land at ${address}`)
    }
    steps.push({ name, address, status: "deployed", source })
    return address
  }

  const owned = [{ type: "address" }]
  const usdc = await create2("TestUsdc", "bluechip.paper.test-usdc", "TestUsdc", owned, [operator])
  const feedWriter = await create2("PaperFeedWriter", "bluechip.paper.feed-writer", "PaperFeedWriter", owned, [
    operator
  ])
  const sequencerFeed = await create2(
    "SequencerUptimeStub",
    "bluechip.paper.sequencer-uptime-stub",
    "SequencerUptimeStub",
    [],
    []
  )
  const factory = await create2("PaperFactory", "bluechip.paper.factory", "PaperFactory", [
    { type: "address" },
    { type: "address" }
  ], [operator, usdc])
  const router = await create2("PaperRouter", "bluechip.paper.router", "PaperRouter", [{ type: "address" }], [factory])
  const quoter = await create2("PaperQuoter", "bluechip.paper.quoter", "PaperQuoter", [], [])

  const listed: Array<{ symbol: string; token: Address; feed: Address; pool: Address; price: bigint }> = []
  for (const stock of stocks) {
    const slug = stock.symbol.toLowerCase()
    const token = await create2(`TestStock ${stock.symbol}`, `bluechip.paper.stock.${slug}`, "TestStock", [
      { type: "address" },
      { type: "string" },
      { type: "string" }
    ], [operator, stock.name, stock.symbol])
    const feed = await create2(`PaperFeed ${stock.symbol}`, `bluechip.paper.feed.${slug}`, "PaperFeed", [
      { type: "address" },
      { type: "string" }
    ], [feedWriter, `${stock.symbol} / USD`])
    listed.push({ symbol: stock.symbol, token, feed, pool: zeroAddress, price: stock.price })
  }

  // A feed never written has round 0: seed every such feed in one push.
  const unseeded: typeof listed = []
  for (const stock of listed) {
    const [round] = await client.readContract({
      address: stock.feed,
      abi: aggregatorAbi,
      functionName: "latestRoundData"
    })
    if (round === BigInt(0)) unseeded.push(stock)
    steps.push({
      name: `seed ${stock.symbol}`,
      address: stock.feed,
      status: round === BigInt(0) ? "deployed" : "present"
    })
  }
  if (unseeded.length > 0) {
    await send(client.writeContract({
      address: feedWriter,
      abi: paperFeedWriterAbi,
      functionName: "push",
      args: [unseeded.map((stock) => stock.feed), unseeded.map((stock) => stock.price)]
    }))
  }

  for (const stock of listed) {
    const poolOf = () =>
      client.readContract({
        address: factory,
        abi: paperFactoryAbi,
        functionName: "getPool",
        args: [usdc, stock.token, PAPER_TICK_SPACING]
      })
    let pool = await poolOf()
    const created = isAddressEqual(pool, zeroAddress)
    if (created) {
      await send(client.writeContract({
        address: factory,
        abi: paperFactoryAbi,
        functionName: "createPool",
        args: [stock.token, stock.feed, PAPER_TICK_SPACING, PAPER_FEE_PIPS]
      }))
      pool = await poolOf()
    }
    steps.push({ name: `PaperPool ${stock.symbol}`, address: pool, status: created ? "deployed" : "present" })
    stock.pool = pool

    // The pool mints what it's short of: USDC when it pays a sell, the stock when it pays a buy.
    for (const token of [usdc, stock.token]) {
      const allowed = await client.readContract({
        address: token,
        abi: paperTokenAbi,
        functionName: "isMinter",
        args: [pool]
      })
      if (!allowed) {
        await send(
          client.writeContract({ address: token, abi: paperTokenAbi, functionName: "setMinter", args: [pool, true] })
        )
      }
      const which = token === usdc ? "USDC" : stock.symbol
      steps.push({
        name: `minter ${which} ${stock.symbol} pool`,
        address: token,
        status: allowed ? "present" : "deployed"
      })
    }
  }

  // bluechip's policies and rules, unchanged but for the paper USDC, router and sequencer feed they're built over.
  const policies: Record<string, Address> = {}
  for (const spec of CONTRACTS) {
    const args = spec.name === "AerodromeTradePolicy"
      ? [usdc, router]
      : spec.name === "TradeGuard"
      ? [usdc, sequencerFeed, BigInt(SEQUENCER_GRACE_SECONDS)]
      : spec.constructorArgs
    const key = spec.name[0]!.toLowerCase() + spec.name.slice(1)
    policies[key] = await create2(spec.name, spec.label, spec.name, spec.constructorTypes, args)
  }

  const addresses: PaperAddresses = {
    usdc,
    sequencerFeed,
    feedWriter,
    operator,
    exchange: { factory, router, quoter },
    policies,
    stocks: listed.map(({ feed, pool, symbol, token }) => ({ symbol, token, feed, pool }))
  }
  return { addresses, steps }
}

/** The generated `packages/chain/src/deployments/Sepolia.ts`, for dprint to format. */
export const sepoliaModule = (addresses: PaperAddresses): string =>
  [
    "/**",
    " * bluechip's deployment on Base Sepolia (paper money). Written by `node scripts/bin.ts contracts deploy --network",
    " * sepolia`; do not edit.",
    " *",
    " * @since 0.0.0",
    " */",
    "",
    "/**",
    " * Every address `contracts deploy` placed on Base Sepolia.",
    " *",
    " * @stability unstable",
    " * @category addresses",
    " * @since 0.0.0",
    " */",
    `export const sepoliaAddresses = ${JSON.stringify(addresses, null, 2).replace(/"(\w+)":/g, "$1:")} as const`,
    ""
  ].join("\n")
