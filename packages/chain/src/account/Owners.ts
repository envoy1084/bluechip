/**
 * The account's owners: passkeys on Namera's `WebAuthnValidator`, Kernel's root validator, with a threshold of one so
 * any of them signs. Adding and removing one is a call the account makes on the validator.
 *
 * @since 0.0.0
 */
import * as WebAuthnValidator from "@namera-ai/contracts/WebAuthnValidator"
import * as SmartAccount from "@namera-ai/sdk/effect/accounts/SmartAccount"
import * as Effect from "effect/Effect"
import { type Address, encodeAbiParameters, encodeFunctionData, type Hex, hexToBigInt, keccak256, slice } from "viem"
import { ChainClient } from "../ChainClient.ts"
import { ChainError } from "../ChainError.ts"

/**
 * A call the account makes.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Call {
  readonly to: Address
  readonly data: Hex
}

// An uncompressed P-256 key, `0x04 ‖ x ‖ y`, as the validator's coordinates.
const coordinates = (publicKey: Hex) => ({ x: slice(publicKey, 1, 33), y: slice(publicKey, 33, 65) })

/**
 * A passkey's id on the validator: `keccak256(abi.encode(x, y))` of its public key (`0x04 ‖ x ‖ y`).
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const credentialIdOf = (publicKey: Hex): Hex => {
  const { x, y } = coordinates(publicKey)
  return keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [x, y]))
}

/**
 * The account's call that makes `publicKey` one of its owners. It requires user verification, as Namera installs
 * passkeys, and any relying party (`rpIdHash` zero).
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const addOwnerCall = (publicKey: Hex): Call => ({
  to: WebAuthnValidator.addressV1,
  data: encodeFunctionData({
    abi: WebAuthnValidator.abiV1,
    functionName: "addPasskey",
    args: [{
      ...coordinates(publicKey),
      requireUserVerification: true,
      rpIdHash: "0x0000000000000000000000000000000000000000000000000000000000000000"
    }]
  })
})

/**
 * The account's call that removes the owner `publicKey`. The validator refuses to remove the last one.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const removeOwnerCall = (publicKey: Hex): Call => ({
  to: WebAuthnValidator.addressV1,
  data: encodeFunctionData({
    abi: WebAuthnValidator.abiV1,
    functionName: "removePasskey",
    args: [credentialIdOf(publicKey)]
  })
})

/**
 * The credential ids of the account's passkey owners onchain (none before it is deployed), and how many must sign.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const ownersOf = Effect.fnUntraced(function*(account: Address) {
  const chain = yield* ChainClient
  const sets = yield* SmartAccount.getOwners(chain.client, { address: account }).pipe(
    Effect.mapError((cause) => new ChainError({ operation: "read the account's owners", cause }))
  )
  const passkeys = sets.find((set) => set.type === "passkey")
  return {
    threshold: passkeys?.threshold ?? 0,
    credentialIds: (passkeys?.passkeys ?? []).map((passkey) => passkey.credentialId)
      .sort((a, b) => hexToBigInt(a) < hexToBigInt(b) ? -1 : 1)
  }
})
