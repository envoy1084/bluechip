import { Unavailable } from "@bluechip/domain/Errors"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import * as Effect from "effect/Effect"
import { type Hex, hexToBytes } from "viem"
import {
  formatUserOperation,
  formatUserOperationRequest,
  getUserOperationHash,
  type RpcUserOperation,
  toWebAuthnAccount,
  type UserOperation
} from "viem/account-abstraction"
import { base } from "viem/chains"
import { AppConfig } from "../Config.ts"
import { Namera } from "../Namera.ts"

/** The passkey that owns an account, as stored at sign-up. */
export interface OwnerPasskey {
  readonly credentialId: string
  readonly publicKey: string
}

/** A call the account makes. */
export interface Call {
  readonly to: Hex
  readonly data: Hex
}

const unavailable = (cause: unknown) =>
  Effect.logWarning("Owner operation failed", cause).pipe(
    Effect.andThen(Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: null })))
  )

/**
 * The owner as viem's WebAuthn account. The server never holds the passkey: `assertion` is what the user's browser
 * signed, handed to the signing code as if the authenticator had just answered.
 */
const owner = Effect.fnUntraced(function*(passkey: OwnerPasskey, assertion?: typeof AuthenticationCredential.Type) {
  const config = yield* AppConfig
  return toWebAuthnAccount({
    credential: { id: passkey.credentialId, publicKey: passkey.publicKey as Hex },
    // Given explicitly: without it, ox reads the relying party from `window`, which a server doesn't have.
    rpId: config.rpId,
    getFn: async () => {
      if (assertion === undefined) throw new Error("the owner's signature is collected in the browser")
      const buffer = (value: string) => isoBase64URL.toBuffer(value).buffer as ArrayBuffer
      return {
        id: assertion.id,
        type: "public-key",
        response: {
          clientDataJSON: buffer(assertion.response.clientDataJSON),
          authenticatorData: buffer(assertion.response.authenticatorData),
          signature: buffer(assertion.response.signature)
        }
      } as never
    }
  })
})

/** The user operation's hash as WebAuthn's challenge (base64url of its 32 bytes). */
export const challengeOf = (hash: Hex) => isoBase64URL.fromBuffer(hexToBytes(hash) as Uint8Array<ArrayBuffer>)

/**
 * Builds the account's user operation for `calls` (deploying the account too when it has no code yet), with gas and
 * fees from the bundler, and the hash its owner signs. Stored as is, so what the user signs is what gets sent.
 */
export const prepareOperation = Effect.fn("OwnerOperations.prepare")(
  function*(passkey: OwnerPasskey, calls: ReadonlyArray<Call>) {
    const namera = yield* Namera
    const account = yield* namera.kernelAccount(yield* owner(passkey)).pipe(Effect.catch(unavailable))
    const bundler = namera.bundlerClient(account)
    const prepared = yield* Effect.tryPromise(() => bundler.prepareUserOperation({ account, calls: [...calls] })).pipe(
      Effect.catch(unavailable)
    )
    const userOperation = { ...prepared, signature: "0x" } as UserOperation<"0.7">
    const hash = getUserOperationHash({
      userOperation,
      entryPointAddress: account.entryPoint.address,
      entryPointVersion: "0.7",
      chainId: base.id
    })
    return {
      userOperation: formatUserOperationRequest(userOperation) as Record<string, unknown>,
      hash,
      deploysAccount: userOperation.factory !== undefined && userOperation.factory !== null
    }
  }
)

/** Signs the prepared operation with the browser's assertion and hands it to the bundler; returns its hash. */
export const sendOperation = Effect.fn("OwnerOperations.send")(function*(
  passkey: OwnerPasskey,
  prepared: Record<string, unknown>,
  assertion: typeof AuthenticationCredential.Type
) {
  const namera = yield* Namera
  const account = yield* namera.kernelAccount(yield* owner(passkey, assertion)).pipe(Effect.catch(unavailable))
  const bundler = namera.bundlerClient(account)
  const userOperation = formatUserOperation(prepared as unknown as RpcUserOperation<"0.7">) as UserOperation<"0.7">
  return yield* Effect.tryPromise(async () => {
    const signature = await account.signUserOperation(userOperation)
    // Straight to the bundler: viem's `sendUserOperation` would prepare (and re-estimate) the operation again.
    return await bundler.request({
      method: "eth_sendUserOperation",
      params: [formatUserOperationRequest({ ...userOperation, signature }), account.entryPoint.address]
    })
  }).pipe(Effect.catch(unavailable))
})

/** Waits for the operation to land: its transaction and whether its calls succeeded. */
export const waitForOperation = Effect.fn("OwnerOperations.wait")(function*(passkey: OwnerPasskey, hash: Hex) {
  const namera = yield* Namera
  const account = yield* namera.kernelAccount(yield* owner(passkey)).pipe(Effect.catch(unavailable))
  const receipt = yield* Effect.tryPromise(() =>
    namera.bundlerClient(account).waitForUserOperationReceipt({ hash, timeout: 120_000 })
  ).pipe(Effect.catch(unavailable))
  return { success: receipt.success, txHash: receipt.receipt.transactionHash }
})
