/**
 * Test-only powers over the local fork: give accounts ETH and USDC, mine blocks, move time.
 *
 * @since 0.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Semaphore from "effect/Semaphore"
import {
  type Address,
  createTestClient,
  createWalletClient,
  encodeAbiParameters,
  erc20Abi,
  http,
  keccak256,
  numberToHex,
  type TestClient
} from "viem"
import { ChainClient } from "./ChainClient.ts"
import { ChainError } from "./ChainError.ts"

// Where test USDC comes from: an address with no code, whose balance is minted on the spot and sent on.
const faucet: Address = "0x0000000000000000000000000000000000fa0ce7"

/**
 * Anvil cheatcodes. Only available when `NETWORK` is `local`: building the layer for another network is a defect, so
 * a misconfigured server can never try to mint money.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class DevChain extends Context.Service<DevChain, {
  readonly setEthBalance: (account: Address, wei: bigint) => Effect.Effect<void, ChainError>
  readonly setUsdcBalance: (account: Address, units: bigint) => Effect.Effect<void, ChainError>
  /** Sends `units` of USDC to `account` in a real transfer (a `Transfer` log, as a deposit from a wallet makes). */
  readonly sendUsdc: (account: Address, units: bigint) => Effect.Effect<void, ChainError>
  readonly mine: (blocks: number) => Effect.Effect<void, ChainError>
  readonly increaseTime: (seconds: number) => Effect.Effect<void, ChainError>
  /**
   * Moves the chain's clock to `at`, earlier or later, and mines a block there; later blocks count on from it. Set it
   * back to now afterwards: the chain is shared, and its prices and sessions are dated by the real clock.
   */
  readonly setTime: (at: Date) => Effect.Effect<void, ChainError>
}>()("@bluechip/chain/DevChain") {
  /**
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    DevChain,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      if (chain.network !== "local") {
        return yield* Effect.die(new Error(`DevChain needs NETWORK=local, not ${chain.network}`))
      }
      const anvil: TestClient = createTestClient({
        chain: chain.deployment.chain,
        mode: "anvil",
        transport: http(chain.rpcUrl)
      })
      const { usdc } = chain.deployment
      const use = (operation: string, f: () => Promise<unknown>) =>
        Effect.tryPromise({ try: f, catch: (cause) => new ChainError({ operation, cause }) }).pipe(Effect.asVoid)
      const setUsdcBalance = (account: Address, units: bigint) =>
        use("anvil_setStorageAt", () =>
          anvil.setStorageAt({
            address: usdc,
            // FiatTokenV2_2 keeps balances in `balanceAndBlacklistStates`, storage slot 9; the balance is the low
            // 255 bits.
            index: keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [account, BigInt(9)])),
            value: numberToHex(units, { size: 32 })
          }))

      // One send at a time: each one tops up the faucet and sends from it, so two at once would spend one top-up and
      // share a nonce.
      const faucetLock = yield* Semaphore.make(1)
      const sendUsdc = (account: Address, units: bigint) =>
        Semaphore.withPermit(faucetLock, sendFromFaucet(account, units))
      const sendFromFaucet = Effect.fnUntraced(function*(account: Address, units: bigint) {
        yield* use("anvil_setBalance", () => anvil.setBalance({ address: faucet, value: BigInt(10) ** BigInt(18) }))
        yield* setUsdcBalance(faucet, units)

        yield* use("send USDC", async () => {
          await anvil.impersonateAccount({ address: faucet })
          const wallet = createWalletClient({
            chain: chain.deployment.chain,
            account: faucet,
            transport: http(chain.rpcUrl)
          })
          const hash = await wallet.writeContract({
            address: usdc,
            abi: erc20Abi,
            functionName: "transfer",
            args: [account, units],
            // A USDC transfer takes about 60k; without a limit the estimate can claim the whole block.
            gas: BigInt(100_000)
          })
          await chain.client.waitForTransactionReceipt({ hash })
        })
      })

      return {
        setEthBalance: (account, wei) =>
          use("anvil_setBalance", () => anvil.setBalance({ address: account, value: wei })),
        setUsdcBalance,
        sendUsdc,
        mine: (blocks) => use("anvil_mine", () => anvil.mine({ blocks })),
        increaseTime: (seconds) => use("evm_increaseTime", () => anvil.increaseTime({ seconds })),
        setTime: (at) =>
          use("anvil_setTime", async () => {
            await anvil.request({
              method: "anvil_setTime" as never,
              params: [Math.floor(at.getTime() / 1000)] as never
            })
            await anvil.mine({ blocks: 1 })
          })
      }
    })
  )
}
