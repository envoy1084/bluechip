import { Unavailable } from "@bluechip/domain/Errors"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import type * as KernelAccount from "@namera-ai/sdk/effect/accounts/KernelAccount"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type Hex, hexToBytes, type Log } from "viem"
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

/** A user operation's receipt: its transaction, whether its calls succeeded, and the logs they emitted. */
export interface Receipt {
  readonly success: boolean
  readonly txHash: Hex
  readonly logs: ReadonlyArray<Log>
}

/** The user operation's hash as WebAuthn's challenge (base64url of its 32 bytes). */
export const challengeOf = (hash: Hex) => isoBase64URL.fromBuffer(hexToBytes(hash) as Uint8Array<ArrayBuffer>)

/**
 * User operations of an account owned by a passkey. The server never holds the passkey: it builds the operation and
 * its hash, the user's browser signs that hash, and the server sends the operation with the browser's signature.
 */
export class OwnerOperations extends Context.Service<OwnerOperations, {
  /** The owner's Kernel account, for reads and grants that need it (it signs nothing without the browser). */
  readonly account: (passkey: OwnerPasskey) => Effect.Effect<KernelAccount.KernelAccount, Unavailable>
  /**
   * Builds the account's user operation for `calls` (deploying the account too when it has no code yet), with gas and
   * fees from the bundler (call gas at least `minCallGas`), and the hash its owner signs. Stored as is, so what the
   * user signs is what gets sent.
   */
  readonly prepare: (
    passkey: OwnerPasskey,
    calls: ReadonlyArray<Call>,
    minCallGas?: bigint
  ) => Effect.Effect<
    { readonly userOperation: Record<string, unknown>; readonly hash: Hex; readonly deploysAccount: boolean },
    Unavailable
  >
  /** Signs the prepared operation with the browser's assertion and hands it to the bundler; returns its hash. */
  readonly send: (
    passkey: OwnerPasskey,
    prepared: Record<string, unknown>,
    assertion: typeof AuthenticationCredential.Type
  ) => Effect.Effect<Hex, Unavailable>
  /** Waits for the operation to land. */
  readonly wait: (passkey: OwnerPasskey, hash: Hex) => Effect.Effect<Receipt, Unavailable>
}>()("@bluechip/server/OwnerOperations") {
  static readonly layer = Layer.effect(
    OwnerOperations,
    Effect.gen(function*() {
      const config = yield* AppConfig
      const namera = yield* Namera

      const unavailable = (cause: unknown) =>
        Effect.logWarning("Owner operation failed", cause).pipe(
          Effect.andThen(Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: null })))
        )

      // The owner as viem's WebAuthn account: `assertion` is what the user's browser signed, handed to the signing code
      // as if the authenticator had just answered.
      const kernelAccount = (passkey: OwnerPasskey, assertion?: typeof AuthenticationCredential.Type) =>
        namera.kernelAccount(toWebAuthnAccount({
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
        })).pipe(Effect.catch(unavailable))

      const prepare = Effect.fn("OwnerOperations.prepare")(
        function*(passkey: OwnerPasskey, calls: ReadonlyArray<Call>, minCallGas?: bigint) {
          const account = yield* kernelAccount(passkey)
          const bundler = namera.bundlerClient(account)
          const prepared = yield* Effect.tryPromise(() => bundler.prepareUserOperation({ account, calls: [...calls] }))
            .pipe(Effect.catch(unavailable))
          const userOperation = {
            ...prepared,
            // Some calls are estimated short (a swap, see `swapCallGas`): a floor keeps them whole.
            callGasLimit: minCallGas !== undefined && prepared.callGasLimit < minCallGas
              ? minCallGas
              : prepared.callGasLimit,
            signature: "0x"
          } as UserOperation<"0.7">
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

      const send = Effect.fn("OwnerOperations.send")(function*(
        passkey: OwnerPasskey,
        prepared: Record<string, unknown>,
        assertion: typeof AuthenticationCredential.Type
      ) {
        const account = yield* kernelAccount(passkey, assertion)
        const bundler = namera.bundlerClient(account)
        const userOperation = formatUserOperation(prepared as unknown as RpcUserOperation<"0.7">) as UserOperation<
          "0.7"
        >
        return yield* Effect.tryPromise(async () => {
          const signature = await account.signUserOperation(userOperation)
          // Straight to the bundler: viem's `sendUserOperation` would prepare (and re-estimate) the operation again.
          return await bundler.request({
            method: "eth_sendUserOperation",
            params: [formatUserOperationRequest({ ...userOperation, signature }), account.entryPoint.address]
          })
        }).pipe(Effect.catch(unavailable))
      })

      const wait = Effect.fn("OwnerOperations.wait")(function*(passkey: OwnerPasskey, hash: Hex) {
        const account = yield* kernelAccount(passkey)
        const receipt = yield* Effect.tryPromise(() =>
          namera.bundlerClient(account).waitForUserOperationReceipt({ hash, timeout: 120_000 })
        ).pipe(Effect.catch(unavailable))
        return { success: receipt.success, txHash: receipt.receipt.transactionHash, logs: receipt.logs }
      })

      return OwnerOperations.of({ account: (passkey) => kernelAccount(passkey), prepare, send, wait })
    })
  )
}
