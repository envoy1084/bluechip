// Builds the devnet's state once: a bare Anvil running Base's hardfork gets every contract bluechip uses at its real
// address, copied from a fork of Base (the code, and the storage each call reads), plus real B20 stock tokens, the
// Slipstream pools with liquidity, and settable price feeds. The result is Anvil's own state dump, which each test
// worker's Anvil loads in one call.
import { entryPoint07, stocks, usdc } from "@bluechip/chain/Contracts"
import { factory, metaquoter, swapRouter } from "@bluechip/chain/market/Aerodrome"
import * as Namera from "@namera-ai/contracts"
import { gunzipSync } from "node:zlib"
import { Instance } from "prool"
import {
  type Address,
  decodeAbiParameters,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  pad,
  parseAbi,
  toHex
} from "viem"
import { liquidityFor, rangeAround, sqrtPriceX96Of, tickOf } from "./pools.ts"

/** Anvil's first development account: it administers the devnet's tokens and pays for its setup. */
export const DEVNET_ADMIN: Address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

/** Where the devnet keeps the contract that seeds its pools. */
export const POOL_SEEDER: Address = "0x00000000000000000000000000000000005eed00"

const multicall3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11"
const b20Factory: Address = "0xB20f000000000000000000000000000000000000"
const activationRegistry: Address = "0x8453000000000000000000000000000000000001"
const kernel = Namera.External.kernel["3.3"]

// FiatTokenV2_2 keeps balances in `balanceAndBlacklistStates`, slot 9.
const usdcBalanceSlot = (account: Address) =>
  keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [account, BigInt(9)]))

const MINT_ROLE = keccak256(toHex("MINT_ROLE"))
const OPERATOR_ROLE = keccak256(toHex("OPERATOR_ROLE"))

// Each pool gets about $50,000 of USDC between its price and about 49% above, and as much stock below.
const POOL_DEPTH = BigInt(50_000) * BigInt(1_000_000)
const POOL_WIDTH_TICKS = 4000

const abi = parseAbi([
  "function createPool(address tokenA, address tokenB, int24 tickSpacing, uint160 sqrtPriceX96) returns (address)",
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address)",
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256)",
  "function quoteExactInputSingleV3(address pool, address tokenIn, uint256 amountIn, uint160 sqrtPriceLimitX96) returns (uint256, uint160, uint32)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function multiplier() view returns (uint256)",
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function createB20(uint8 variant, bytes32 salt, bytes params, bytes[] initCalls) returns (address)",
  "function activate(bytes32 feature)",
  "function grantRole(bytes32 role, address account)",
  "function mint(address to, uint256 amount)",
  "function updateMultiplier(uint256 multiplier)",
  "function approveFactory(address factory, bool approval)",
  "function stake(address entryPoint, uint32 unstakeDelay) payable",
  "function seed(address pool, int24 tickLower, int24 tickUpper, uint128 liquidity)"
])

type Call = { readonly to: Address; readonly data: Hex; readonly value?: Hex; readonly from?: Address }
type Sample = { readonly call: Call; readonly codeOnly: boolean }
type Prestate = Record<string, { readonly code?: Hex; readonly storage?: Record<Hex, Hex> }>

const node = (url: string) => {
  let id = 0
  const request = async <A = unknown>(method: string, params: ReadonlyArray<unknown> = []): Promise<A> => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params })
    })
    const body = await response.json() as { result?: A; error?: { message: string; data?: unknown } }
    if (body.error !== undefined) throw new Error(`${method}: ${body.error.message} ${JSON.stringify(body.error.data)}`)
    return body.result as A
  }

  const send = async (label: string, call: Call) => {
    const hash = await request<Hex>("eth_sendTransaction", [{ from: DEVNET_ADMIN, gas: "0x1000000", ...call }])
    // Anvil answers before automine has the block, so the receipt can take a moment.
    let receipt: { status: Hex } | null = null
    while (receipt === null) {
      receipt = await request<{ status: Hex } | null>("eth_getTransactionReceipt", [hash])
      if (receipt === null) await new Promise((resolve) => setTimeout(resolve, 20))
    }
    if (receipt.status === "0x1") return

    const reason = await request("eth_call", [{ from: DEVNET_ADMIN, ...call }, "latest"]).then(
      () => "no revert on replay",
      (error: Error) => error.message
    )
    throw new Error(`devnet capture: ${label} failed (${reason})`)
  }

  const read = (call: Call) => request<Hex>("eth_call", [{ from: DEVNET_ADMIN, ...call }, "latest"])

  const prestate = (call: Call) =>
    request<Prestate>("debug_traceCall", [
      { from: DEVNET_ADMIN, gas: "0x1000000", ...call },
      "latest",
      { tracer: "prestateTracer" }
    ])

  return { request, send, read, prestate }
}

type Node = ReturnType<typeof node>

const readToken = async (chain: Node, token: Address) => {
  const read = (functionName: "name" | "symbol" | "decimals" | "multiplier") =>
    chain.read({ to: token, data: encodeFunctionData({ abi, functionName }) })

  return {
    name: decodeAbiParameters([{ type: "string" }], await read("name"))[0],
    symbol: decodeAbiParameters([{ type: "string" }], await read("symbol"))[0],
    decimals: decodeAbiParameters([{ type: "uint8" }], await read("decimals"))[0],
    multiplier: decodeAbiParameters([{ type: "uint256" }], await read("multiplier"))[0]
  }
}

// What a call needs that is infrastructure: accounts with code, minus stock tokens, pools, Base's system contracts
// and precompiles, which the devnet makes or Anvil already has.
const isInfrastructure = (address: string, account: Prestate[string]) => {
  const lower = address.toLowerCase()
  if (account.code === undefined || account.code === "0x") return false
  if (lower.startsWith("0xb20000000000000000000") || lower === b20Factory.toLowerCase()) return false
  if (lower.startsWith("0x4200000000000000000000000000000000") || lower.startsWith("0x845300000000000000000000")) {
    return false
  }
  // Pools are minimal proxies (45 bytes) of the pool implementation.
  return !account.code.startsWith("0x363d3d373d3d3d363d73")
}

/**
 * Copies what `calls` read on the fork into the bare chain. A sample marked `codeOnly` runs against one of
 * mainnet's pools, so the storage it reads (the factory's and pool registry's records of that pool) would make the
 * devnet's own `createPool` revert: only its code is taken.
 */
const copyPrestate = async (fork: Node, bare: Node, samples: ReadonlyArray<Sample>) => {
  const accounts = new Map<string, { code: Hex; storage: Record<Hex, Hex> }>()

  for (const sample of samples) {
    for (const [address, account] of Object.entries(await fork.prestate(sample.call))) {
      if (!isInfrastructure(address, account)) continue
      const known = accounts.get(address) ?? { code: account.code!, storage: {} }
      const storage = sample.codeOnly ? {} : account.storage
      accounts.set(address, { code: known.code, storage: { ...known.storage, ...storage } })
    }
  }

  for (const [address, account] of accounts) {
    await bare.request("anvil_setCode", [address, account.code])
    for (const [slot, value] of Object.entries(account.storage)) {
      await bare.request("anvil_setStorageAt", [address, slot, value])
    }
  }
  return [...accounts.keys()]
}

/** Copies the runtime code of contracts that keep no state of their own (EntryPoint, Kernel, Namera, Multicall3). */
const copyCode = async (fork: Node, bare: Node, addresses: ReadonlyArray<Address>) => {
  for (const address of addresses) {
    const code = await fork.request<Hex>("eth_getCode", [address, "latest"])
    if (code === "0x") throw new Error(`devnet capture: no code at ${address} on the fork`)
    await bare.request("anvil_setCode", [address, code])
  }
}

const nameraAddresses = (): ReadonlyArray<Address> =>
  Object.values(Namera).flatMap((module) =>
    typeof module === "object" && module !== null && "addressV1" in module ? [module.addressV1 as Address] : []
  )

// ZeroDev's FactoryStaker as on every mainnet: it approves the Kernel 3.3 factory and holds 0.1 ETH of EntryPoint
// stake with a one-day delay, which ERC-7562 needs for account deployment through it (as Namera's devnet sets it).
const stakeKernelFactory = async (bare: Node) => {
  const ownerSlot = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff74873927"
  await bare.request("anvil_setStorageAt", [kernel.factoryStaker, ownerSlot, pad(DEVNET_ADMIN)])
  await bare.send("approving the Kernel factory", {
    to: kernel.factoryStaker,
    data: encodeFunctionData({ abi, functionName: "approveFactory", args: [kernel.factory, true] })
  })
  await bare.send("staking the Kernel FactoryStaker", {
    to: kernel.factoryStaker,
    value: toHex(BigInt(10) ** BigInt(17)),
    data: encodeFunctionData({ abi, functionName: "stake", args: [entryPoint07, 86_400] })
  })
}

const dumpedStorage = async (bare: Node, address: Address): Promise<Record<Hex, Hex>> => {
  const dump = await bare.request<Hex>("anvil_dumpState")
  const state = JSON.parse(gunzipSync(Buffer.from(dump.slice(2), "hex")).toString()) as {
    accounts: Record<string, { storage?: Record<Hex, Hex> }>
  }
  return state.accounts[address.toLowerCase()]?.storage ?? {}
}

// B20 creation is gated by the ActivationRegistry: the factory names the feature it needs, the admin activates it.
const activateB20 = async (bare: Node) => {
  const params = encodeAbiParameters(
    [{
      type: "tuple",
      components: [{ type: "uint8" }, { type: "string" }, { type: "string" }, { type: "address" }, { type: "uint8" }]
    }],
    [[1, "probe", "PROBE", DEVNET_ADMIN, 8]]
  )
  const data = encodeFunctionData({ abi, functionName: "createB20", args: [0, pad("0x01"), params, []] })
  const revert = await bare.read({ to: b20Factory, data }).then(() => undefined, (error: Error) => error.message)
  const feature = /0xb9b2a425([0-9a-f]{64})/.exec(revert ?? "")?.[1]
  if (feature === undefined) return

  await bare.send("activating B20", {
    to: activationRegistry,
    data: encodeFunctionData({ abi, functionName: "activate", args: [`0x${feature}`] })
  })
}

/**
 * Makes each stock a real B20 at its real address: a token created on the bare chain (Coinbase's salt can't be
 * replayed), with the devnet admin as minter and operator and the fork's multiplier, then copied over, since a B20
 * keeps its state in its own storage.
 */
const installStocks = async (fork: Node, bare: Node) => {
  await activateB20(bare)

  for (const stock of stocks) {
    const { decimals, multiplier, name, symbol } = await readToken(fork, stock.token)

    const params = encodeAbiParameters(
      [{
        type: "tuple",
        components: [{ type: "uint8" }, { type: "string" }, { type: "string" }, { type: "address" }, { type: "uint8" }]
      }],
      [[1, name, symbol, DEVNET_ADMIN, decimals]]
    )
    const create = encodeFunctionData({
      abi,
      functionName: "createB20",
      args: [0, keccak256(toHex(`bluechip devnet ${stock.symbol}`)), params, []]
    })
    const template = decodeAbiParameters([{ type: "address" }], await bare.read({ to: b20Factory, data: create }))[0]
    await bare.send(`creating ${stock.symbol}`, { to: b20Factory, data: create })

    for (const role of [MINT_ROLE, OPERATOR_ROLE]) {
      await bare.send(`granting ${stock.symbol} a role`, {
        to: template,
        data: encodeFunctionData({ abi, functionName: "grantRole", args: [role, DEVNET_ADMIN] })
      })
    }
    if (multiplier !== BigInt(10) ** BigInt(18)) {
      await bare.send(`setting ${stock.symbol}'s multiplier`, {
        to: template,
        data: encodeFunctionData({ abi, functionName: "updateMultiplier", args: [multiplier] })
      })
    }

    await bare.request("anvil_setCode", [stock.token, "0xef"])
    for (const [slot, value] of Object.entries(await dumpedStorage(bare, template))) {
      await bare.request("anvil_setStorageAt", [stock.token, slot, value])
    }
  }
}

/** Puts the price feed mock at each stock's feed address, starting at the fork's price. */
const installFeeds = async (fork: Node, bare: Node, mockFeed: Hex) => {
  for (const stock of stocks) {
    const round = decodeFunctionResult({
      abi,
      functionName: "latestRoundData",
      data: await fork.read({ to: stock.feed, data: encodeFunctionData({ abi, functionName: "latestRoundData" }) })
    })
    await bare.request("anvil_setCode", [stock.feed, mockFeed])
    await bare.request("anvil_setStorageAt", [stock.feed, pad("0x00"), pad(toHex(round[1]))])
  }
}

/** Creates each stock's USDC pool (at its pinned address) at the feed's price, and seeds it with liquidity. */
const installPools = async (bare: Node, poolSeeder: Hex) => {
  await bare.request("anvil_setCode", [POOL_SEEDER, poolSeeder])
  await bare.request("anvil_setStorageAt", [usdc, usdcBalanceSlot(POOL_SEEDER), pad(toHex(BigInt(10) ** BigInt(15)))])

  for (const stock of stocks) {
    if (stock.pool === null) continue

    const price = BigInt(
      await bare.read({ to: stock.feed, data: encodeFunctionData({ abi, functionName: "latestRoundData" }) }).then((
        data
      ) => decodeFunctionResult({ abi, functionName: "latestRoundData", data })[1])
    )
    const sqrtPriceX96 = sqrtPriceX96Of(price)

    await bare.send(`minting ${stock.symbol} for its pool`, {
      to: stock.token,
      data: encodeFunctionData({ abi, functionName: "mint", args: [POOL_SEEDER, BigInt(10) ** BigInt(16)] })
    })
    await bare.send(`creating the ${stock.symbol} pool`, {
      to: factory,
      data: encodeFunctionData({
        abi,
        functionName: "createPool",
        args: [usdc, stock.token, stock.pool.tickSpacing, sqrtPriceX96]
      })
    })

    const pool = decodeFunctionResult({
      abi,
      functionName: "getPool",
      data: await bare.read({
        to: factory,
        data: encodeFunctionData({ abi, functionName: "getPool", args: [usdc, stock.token, stock.pool.tickSpacing] })
      })
    })
    if (pool.toLowerCase() !== stock.pool.address.toLowerCase()) {
      throw new Error(`devnet capture: the ${stock.symbol} pool is at ${pool}, not ${stock.pool.address}`)
    }

    const range = rangeAround(tickOf(sqrtPriceX96), POOL_WIDTH_TICKS, stock.pool.tickSpacing)
    await bare.send(`seeding the ${stock.symbol} pool`, {
      to: POOL_SEEDER,
      data: encodeFunctionData({
        abi,
        functionName: "seed",
        args: [pool, range.lower, range.upper, liquidityFor(POOL_DEPTH, sqrtPriceX96, range.upper)]
      })
    })
  }
}

/**
 * The calls whose reads the devnet needs on Base: making a pool and moving USDC (code and storage), and swapping and
 * quoting on NVDA's pool (code only, see `copyPrestate`).
 */
const samples = (): ReadonlyArray<Sample> => {
  const nvda = stocks.find((stock) => stock.symbol === "NVDA")!
  const amount = BigInt(10_000_000)
  const sample = (to: Address, data: Hex, codeOnly = false): Sample => ({ call: { to, data }, codeOnly })

  return [
    sample(
      factory,
      encodeFunctionData({
        abi,
        functionName: "createPool",
        args: [usdc, "0xb200000000000000000000000000000000000001", 10, BigInt(2) ** BigInt(96)]
      })
    ),
    sample(usdc, encodeFunctionData({ abi, functionName: "transfer", args: [POOL_SEEDER, amount] })),
    sample(usdc, encodeFunctionData({ abi, functionName: "approve", args: [POOL_SEEDER, amount] })),
    sample(
      swapRouter,
      encodeFunctionData({
        abi,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: usdc,
          tokenOut: nvda.token,
          tickSpacing: nvda.pool!.tickSpacing,
          recipient: DEVNET_ADMIN,
          deadline: BigInt(2) ** BigInt(40),
          amountIn: amount,
          amountOutMinimum: BigInt(0),
          sqrtPriceLimitX96: BigInt(0)
        }]
      }),
      true
    ),
    sample(
      metaquoter,
      encodeFunctionData({
        abi,
        functionName: "quoteExactInputSingleV3",
        args: [nvda.pool!.address, usdc, amount, BigInt(0)]
      }),
      true
    )
  ]
}

/** The helper contracts' runtime bytecode, from `forge build` in `packages/devnet/contracts`. */
export interface HelperCode {
  readonly mockFeed: Hex
  readonly poolSeeder: Hex
}

/**
 * Captures the devnet: forks Base at `forkBlock` through `forkRpcUrl`, builds the bare chain from it, and returns the
 * bare chain's state dump (gzipped JSON, as `anvil_dumpState` gives it).
 */
export const captureDevnet = async (options: {
  readonly forkRpcUrl: string
  readonly forkBlock: bigint
  readonly helpers: HelperCode
  readonly log: (message: string) => void
}): Promise<Buffer> => {
  const forkInstance = Instance.anvil({
    forkUrl: options.forkRpcUrl,
    forkBlockNumber: options.forkBlock,
    hardfork: "base:Denim" as never,
    chainId: 8453,
    port: 18_646
  })
  const bareInstance = Instance.anvil({
    hardfork: "base:Denim" as never,
    chainId: 8453,
    baseActivationAdmin: DEVNET_ADMIN,
    port: 18_647
  } as never)

  await forkInstance.start()
  await bareInstance.start()

  try {
    const fork = node("http://localhost:18646")
    const bare = node("http://localhost:18647")

    // The fork's admin needs USDC and an approval for the swap and transfers to trace.
    await fork.request("anvil_setStorageAt", [
      usdc,
      usdcBalanceSlot(DEVNET_ADMIN),
      pad(toHex(BigInt(10) ** BigInt(12)))
    ])
    await fork.send("approving the router on the fork", {
      to: usdc,
      data: encodeFunctionData({ abi, functionName: "approve", args: [swapRouter, BigInt(10) ** BigInt(12)] })
    })

    options.log("copying Aerodrome and USDC")
    const copied = await copyPrestate(fork, bare, samples())
    options.log(`  ${copied.length} contracts with the storage they read`)

    options.log("copying EntryPoint 0.7, Kernel 3.3, Namera and Multicall3")
    await copyCode(fork, bare, [
      entryPoint07,
      Namera.External.entryPoint["0.7"].senderCreator,
      kernel.factory,
      kernel.factoryStaker,
      kernel.implementation,
      kernel.ecdsaValidator,
      ...nameraAddresses(),
      multicall3
    ])
    await stakeKernelFactory(bare)

    options.log("creating the stock tokens")
    await installStocks(fork, bare)

    options.log("installing the price feeds and pools")
    await installFeeds(fork, bare, options.helpers.mockFeed)
    await installPools(bare, options.helpers.poolSeeder)

    const dump = await bare.request<Hex>("anvil_dumpState")
    return Buffer.from(dump.slice(2), "hex")
  } finally {
    await bareInstance.stop()
    await forkInstance.stop()
  }
}
