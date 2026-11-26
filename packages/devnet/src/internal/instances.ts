import { Instance } from "prool"
import { BASE_FEE_WEI, BUNDLER_KEYS } from "../Controls.ts"

/**
 * Anvil from the captured state: Base's latest hardfork runs the B20 precompiles, chain id 8453 so signatures match
 * Base's, and Base's fees (about 0.01 gwei), so gas budgets behave as they do on Base.
 *
 * @internal
 */
export const anvil = (state: string): Instance.Instance =>
  Instance.anvil({
    hardfork: "base:Denim" as never,
    chainId: 8453,
    loadState: state,
    blockBaseFeePerGas: BASE_FEE_WEI
  })

/**
 * Alto on EntryPoint v0.7 against the Anvil at `rpcUrl`, tracing every operation's validation against ERC-7562 as
 * the shared mempool does, and bundling as soon as an operation arrives.
 *
 * @internal
 */
export const alto = (rpcUrl: string): Instance.Instance =>
  Instance.alto({
    entrypoints: ["0x0000000071727De22E5E9d8BAf0edAc6f37da032"],
    rpcUrl,
    executorPrivateKeys: [BUNDLER_KEYS.executor],
    utilityPrivateKey: BUNDLER_KEYS.utility,
    safeMode: true,
    bundleMode: "auto",
    maxBundleWait: 50,
    pollingInterval: 50
  })
