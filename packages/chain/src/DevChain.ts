/**
 * Test-only powers over the local fork: give accounts ETH and USDC, mine blocks, move time.
 *
 * @since 0.0.0
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  type Address,
  createTestClient,
  encodeAbiParameters,
  http,
  keccak256,
  numberToHex,
  type TestClient
} from "viem"
import { base } from "viem/chains"
import { ChainClient } from "./ChainClient.ts"
import { ChainError } from "./ChainError.ts"
import { usdc } from "./Contracts.ts"

// FiatTokenV2_2 keeps balances in `balanceAndBlacklistStates`, storage slot 9; the balance is the low 255 bits.
const usdcBalancesSlot = BigInt(9)

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
  readonly mine: (blocks: number) => Effect.Effect<void, ChainError>
  readonly increaseTime: (seconds: number) => Effect.Effect<void, ChainError>
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
      const anvil: TestClient = createTestClient({ chain: base, mode: "anvil", transport: http(chain.rpcUrl) })
      const use = (operation: string, f: () => Promise<unknown>) =>
        Effect.tryPromise({ try: f, catch: (cause) => new ChainError({ operation, cause }) }).pipe(Effect.asVoid)
      return {
        setEthBalance: (account, wei) =>
          use("anvil_setBalance", () => anvil.setBalance({ address: account, value: wei })),
        setUsdcBalance: (account, units) =>
          use("anvil_setStorageAt", () =>
            anvil.setStorageAt({
              address: usdc,
              index: keccak256(
                encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [account, usdcBalancesSlot])
              ),
              value: numberToHex(units, { size: 32 })
            })),
        mine: (blocks) => use("anvil_mine", () => anvil.mine({ blocks })),
        increaseTime: (seconds) => use("evm_increaseTime", () => anvil.increaseTime({ seconds }))
      }
    })
  )
}
