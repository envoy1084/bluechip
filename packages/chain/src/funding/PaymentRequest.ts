/**
 * Payment requests a wallet can open: the QR code a deposit shows.
 *
 * @since 0.0.0
 */
import type { Address } from "viem"
import { deploymentOf } from "../ChainDeployment.ts"
import type { Network } from "../Network.ts"

/**
 * An EIP-681 request to send USDC to `recipient` on `network`:
 * `ethereum:<USDC>@<chain id>/transfer?address=<recipient>`, with `&uint256=<units>` when an amount is given. A wallet
 * that scans it (Rainbow, MetaMask, Ambire, Coinbase Wallet) opens a USDC transfer on the right network with the
 * recipient filled in.
 *
 * **Example** (Your deposit address on Base)
 *
 * ```ts import.meta.vitest
 * import { usdcTransferRequest } from "@bluechip/chain/funding/PaymentRequest"
 *
 * usdcTransferRequest({ network: "base", recipient: "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4" })
 * // "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const usdcTransferRequest = (
  { network, recipient, amount }: {
    readonly network: Network
    readonly recipient: Address
    /** In USDC's units (6 decimals); without it the wallet asks how much. */
    readonly amount?: bigint
  }
): string => {
  const { chainId, usdc } = deploymentOf(network)
  const request = `ethereum:${usdc}@${chainId}/transfer?address=${recipient}`
  return amount === undefined ? request : `${request}&uint256=${amount}`
}
