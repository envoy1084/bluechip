/**
 * A local Base for tests. Every contract bluechip uses sits at its real address (EntryPoint 0.7, Kernel 3.3,
 * Namera, USDC, the 13 stocks as real B20 tokens, Aerodrome Slipstream with seeded pools), with Chainlink's feeds
 * replaced by ones the test sets. Each Vitest worker has its own Anvil and Alto (see `globalSetup`).
 *
 * @since 0.0.0
 */
import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type Instance, Pool } from "prool"
import { Server } from "prool/vitest"
import { type Address, encodeFunctionData, type Hex, toHex } from "viem"
import {
  entryPoint07Abi,
  entryPoint07Address,
  toPackedUserOperation,
  type UserOperation
} from "viem/account-abstraction"
import * as Controls from "./Controls.ts"
import * as Instances from "./internal/instances.ts"

/**
 * The URLs `globalSetup` provides to test workers, under `contextKey`.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type DevnetContext = {
  readonly anvil: { readonly url: string }
  readonly alto: { readonly url: string }
}

/**
 * The key the devnet's context is provided under; read it in a test with Vitest's `inject`.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const contextKey = "@bluechip/devnet/Devnet" as const

/**
 * The key the unpacked captured state's path is provided under, for `Devnet.layerIsolated`.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const stateKey = "@bluechip/devnet/Devnet/state" as const

const stockOf = (symbol: string) => {
  const stock = stocks.find((candidate) => candidate.symbol === symbol)
  if (stock === undefined) throw new Error(`Devnet: no stock ${symbol}`)
  return stock
}

/**
 * The EntryPoint's `handleOps` of signed user operations, with the admin as beneficiary: a bundler's transaction.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const handleOpsCall = (operations: ReadonlyArray<UserOperation<"0.7">>): { to: Address; data: Hex } => ({
  to: entryPoint07Address,
  data: encodeFunctionData({
    abi: entryPoint07Abi,
    functionName: "handleOps",
    args: [operations.map((operation) => toPackedUserOperation(operation)), Controls.DEVNET_ADMIN]
  })
})

// Starts `instance` on a free port for the scope (prool's pool picks the port), and stops it when the scope closes.
const startInstance = (instance: Instance.Instance) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const pool = Pool.define({ instance, limit: 1 })
      return { pool, started: await pool.start(1) }
    }),
    ({ pool }) => Effect.promise(() => pool.destroyAll())
  )

// Restarts Alto with its clock `seconds` ahead of the real one: it checks an operation's validAfter against its own
// `Date.now`, which a preload shifts. Node reads NODE_OPTIONS when Alto's process starts, so it is set only meanwhile.
const restartAhead = async (alto: Pick<Instance.Instance, "restart">, seconds: number) => {
  const shift = encodeURIComponent(`const now = Date.now; Date.now = () => now() + ${seconds * 1000};`)
  const previous = process.env["NODE_OPTIONS"]
  process.env["NODE_OPTIONS"] = [previous, `--import=data:text/javascript,${shift}`].filter(Boolean).join(" ")
  try {
    await alto.restart()
  } finally {
    if (previous === undefined) delete process.env["NODE_OPTIONS"]
    else process.env["NODE_OPTIONS"] = previous
  }
}

const make = Effect.fnUntraced(function*(rpcUrl: string, bundlerUrl: string) {
  const anvil = Controls.rpc(rpcUrl)
  const now = () => Math.floor(Date.now() / 1000)

  const setPrice = (symbol: string, price: bigint, options: { readonly ageSeconds?: number } = {}) =>
    Effect.promise(() => Controls.setFeed(anvil, stockOf(symbol).feed, price, now() - (options.ageSeconds ?? 0)))
  const mintShares = (account: Address, symbol: string, shares: bigint) =>
    Effect.promise(() => Controls.mintShares(anvil, stockOf(symbol).token, account, shares))
  const movePool = (symbol: string, price: bigint) =>
    Effect.promise(() => Controls.movePool(anvil, stockOf(symbol), price))
  const sendSharesOut = (account: Address, symbol: string, shares: bigint) =>
    Effect.promise(() => Controls.transferTokens(anvil, stockOf(symbol).token, account, Controls.DEVNET_ADMIN, shares))

  yield* Effect.promise(async () => {
    // The captured state brings back the capture's clock: agents state the latest block's time and Namera
    // bounds their operations to its UTC day, which the bundler checks against the real clock.
    const latest = await anvil("eth_getBlockByNumber", ["latest", false]) as { readonly timestamp: string }
    if (Number(latest.timestamp) < now()) await anvil("anvil_setTime", [now()])
    await anvil("anvil_setNextBlockBaseFeePerGas", [toHex(Controls.BASE_FEE_WEI)])
    await anvil("anvil_mine", ["0x1"])
    for (const { feed } of stocks) await Controls.setFeedTime(anvil, feed, now())
    // Alto starts on its first request; let it start now, against the ready chain.
    await Controls.rpc(bundlerUrl)("eth_supportedEntryPoints")
  })

  const simulateAt = (seconds: number, calls: ReadonlyArray<{ readonly to: Address; readonly data: Hex }>) =>
    Effect.promise(async () => {
      const latest = await anvil("eth_getBlockByNumber", ["latest", false]) as { readonly timestamp: Hex }
      const [block] = await anvil("eth_simulateV1", [{
        blockStateCalls: [{
          blockOverrides: { time: toHex(Number(latest.timestamp) + seconds) },
          calls: calls.map((call) => ({ from: Controls.DEVNET_ADMIN, gas: toHex(10_000_000), ...call }))
        }]
      }, "latest"]) as ReadonlyArray<{ readonly calls: ReadonlyArray<{ status: Hex; returnData: Hex }> }>
      return block!.calls.map((call) => ({ success: call.status === "0x1", returnData: call.returnData }))
    })

  return { rpcUrl, bundlerUrl, setPrice, mintShares, sendSharesOut, movePool, simulateAt }
})

/**
 * The current worker's devnet and the controls tests need beyond the chain's own: prices and stock balances.
 * Cash and ETH come from `DevChain`, which works on the devnet as on a fork.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class Devnet extends Context.Service<Devnet, {
  readonly rpcUrl: string
  readonly bundlerUrl: string
  /** Sets a stock's Chainlink price (USD per token, 8 decimals), updated `ageSeconds` ago (0 by default). */
  readonly setPrice: (symbol: string, price: bigint, options?: { readonly ageSeconds?: number }) => Effect.Effect<void>
  /** Mints `shares` (8 decimals) of a stock to `account`. */
  readonly mintShares: (account: Address, symbol: string, shares: bigint) => Effect.Effect<void>
  /**
   * Sends `shares` (8 decimals) of a stock out of `account` to the admin, as the account itself: a transfer made
   * outside bluechip, as with the account's key elsewhere. The account keeps its ETH.
   */
  readonly sendSharesOut: (account: Address, symbol: string, shares: bigint) => Effect.Effect<void>
  /** Trades against a stock's pool until it prices the stock at `price` (USD per token, 8 decimals). */
  readonly movePool: (symbol: string, price: bigint) => Effect.Effect<void>
  /**
   * Simulates `calls` in one block `seconds` after the latest, from the admin, and returns each call's result; the
   * chain itself doesn't change. The bundler refuses an operation not valid yet by the wall clock, so a test checks
   * what the EntryPoint decides later with `handleOpsCall` here. Moving the chain's clock instead would move it for
   * every suite sharing the worker's Anvil.
   */
  readonly simulateAt: (
    seconds: number,
    calls: ReadonlyArray<{ readonly to: Address; readonly data: Hex }>
  ) => Effect.Effect<ReadonlyArray<{ readonly success: boolean; readonly returnData: Hex }>>
}>()("@bluechip/devnet/Devnet") {
  /**
   * Connects to the current worker's devnet: sets Base's base fee (loading the captured state brings the fork's own),
   * moves its clock to now (the captured state brings the capture's) and mines a block, and marks every price as just
   * updated, since the captured state's prices are as old as the capture.
   *
   * @since 0.0.0
   */
  static readonly layer = (context: DevnetContext) =>
    Layer.effect(
      Devnet,
      Effect.suspend(() => {
        const servers = Server.get(context)
        return make(servers.anvil.url, servers.alto.url)
      })
    )

  /**
   * A devnet of its own, for the scope: an Anvil started from the captured `state` (the unpacked file `globalSetup`
   * provides) and an Alto on it, connected as `layer` connects to the worker's. For tests that move the chain's clock:
   * on Base's hardfork Anvil never moves its clock back, so a clock moved on the worker's chain stays moved for every
   * file after.
   *
   * @since 0.0.0
   */
  static readonly layerIsolated = (state: string) =>
    Layer.effectContext(
      Effect.gen(function*() {
        const anvil = yield* startInstance(Instances.anvil(state))
        const alto = yield* startInstance(Instances.alto(anvil.started.url))
        const devnet = yield* make(anvil.started.url, alto.started.url)
        const rpc = Controls.rpc(anvil.started.url)

        const moveAhead = (seconds: number) =>
          Effect.promise(async () => {
            await rpc("anvil_setTime", [Math.floor(Date.now() / 1000) + seconds])
            await rpc("anvil_mine", ["0x1"])
            await restartAhead(alto.started, seconds)
          })

        return Context.make(Devnet, devnet).pipe(Context.add(DevnetClock, { moveAhead }))
      })
    )

  /**
   * The chain client (network `local`) and `DevChain`'s controls, on the devnet.
   *
   * @since 0.0.0
   */
  static readonly layerChain = Layer.unwrap(
    Effect.gen(function*() {
      const devnet = yield* Devnet
      return Layer.provideMerge(DevChain.layer, Layer.succeed(ChainClient, ChainClient.make("local", devnet.rpcUrl)))
    })
  )
}

/**
 * The clocks of a devnet of a file's own (`Devnet.layerIsolated`), which only it can move: on the worker's shared
 * devnet a moved clock would stay moved for every file after.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class DevnetClock extends Context.Service<DevnetClock, {
  /**
   * Moves the chain and the bundler `seconds` ahead of the real clock: the chain's next block is dated then, and Alto
   * restarts with its clock as far ahead, so an operation valid only from then (a recovery 48 hours on) is taken.
   */
  readonly moveAhead: (seconds: number) => Effect.Effect<void>
}>()("@bluechip/devnet/DevnetClock") {}
