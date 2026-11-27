import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { Unavailable } from "@bluechip/domain/Errors"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import type * as KernelAccount from "@namera-ai/sdk/effect/accounts/KernelAccount"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type Hex, hexToBytes, type Log, zeroAddress } from "viem"
import {
  formatUserOperation,
  formatUserOperationRequest,
  getUserOperationHash,
  InsufficientPrefundError,
  type RpcUserOperation,
  toWebAuthnAccount,
  type UserOperation,
  type UserOperationReceipt
} from "viem/account-abstraction"
import { AppConfig } from "../../config/AppConfig.ts"
import { Namera } from "../../platform/namera/Namera.ts"

/** One of the passkeys that own an account, and the account's address. */
export interface OwnerPasskey {
  readonly credentialId: string
  readonly publicKey: string
  readonly account: string
}

/** A call the account makes. */
export interface Call {
  readonly to: Hex
  readonly data: Hex
}

/**
 * A user operation's receipt: its transaction, whether its calls succeeded, the logs they emitted, and the gas it
 * cost (wei), paid by the account or, through a paymaster, by a sponsor.
 */
export interface Receipt {
  readonly success: boolean
  readonly txHash: Hex
  readonly logs: ReadonlyArray<Log>
  readonly gas: { readonly wei: bigint; readonly paidBy: "account" | "sponsor" }
}

/** The receipt of a user operation, as the bundler reports it. */
export const toReceipt = (receipt: UserOperationReceipt): Receipt => ({
  success: receipt.success,
  txHash: receipt.receipt.transactionHash,
  logs: receipt.logs,
  gas: {
    wei: receipt.actualGasCost,
    paidBy: receipt.paymaster === undefined || receipt.paymaster === zeroAddress ? "account" : "sponsor"
  }
})

/**
 * The receipt as the `index`th of `count` trades sent in its operation reads it: the gas shared between them, the
 * first carrying what doesn't divide evenly.
 */
export const shareOf = (receipt: Receipt, index: number, count: number): Receipt => {
  const each = receipt.gas.wei / BigInt(count)
  const wei = index === 0 ? receipt.gas.wei - each * BigInt(count - 1) : each
  return { ...receipt, gas: { ...receipt.gas, wei } }
}

// ERC-4337's AA21: the account couldn't pay the operation's prefund, so it has no ETH for gas and nothing sponsors it.
// The bundler's code reaches us inside a chain of wrapped errors (Effect's, viem's, Namera's), so every cause is read.
const paysNoPrefund = (cause: unknown): boolean => {
  for (let error = cause; error instanceof Error; error = error.cause) {
    if (error instanceof InsufficientPrefundError || /\bAA21\b/.test(error.message)) return true
  }
  return false
}

// Any of the account's passkeys may sign what one of them prepared. The bundler estimates call gas with the preparing
// passkey's stub signature, whose validation warms that passkey's storage; a call reading another passkey's storage
// (removing it, say) then pays for cold reads the estimate never saw. This covers a few cold slots.
const OTHER_SIGNER_CALL_GAS = BigInt(20_000)

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
      const deployment = yield* ChainDeployment

      const unavailable = (cause: unknown) =>
        Effect.logWarning("Owner operation failed", cause).pipe(
          Effect.andThen(
            Effect.fail(
              new Unavailable({ dependency: paysNoPrefund(cause) ? "gas" : "chain", retryAfterSeconds: null })
            )
          )
        )

      // The owner as viem's WebAuthn account: `assertion` is what the user's browser signed, handed to the signing code
      // as if the authenticator had just answered.
      const kernelAccount = (passkey: OwnerPasskey, assertion?: typeof AuthenticationCredential.Type) =>
        namera.kernelAccount(
          toWebAuthnAccount({
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
          }),
          passkey.account as Hex
        ).pipe(Effect.catch(unavailable))

      const prepare = Effect.fn("OwnerOperations.prepare")(
        function*(passkey: OwnerPasskey, calls: ReadonlyArray<Call>, minCallGas?: bigint) {
          const account = yield* kernelAccount(passkey)
          const bundler = namera.bundlerClient(account)
          const prepared = yield* Effect.tryPromise(() => bundler.prepareUserOperation({ account, calls: [...calls] }))
            .pipe(Effect.catch(unavailable))
          const estimated = prepared.callGasLimit + OTHER_SIGNER_CALL_GAS
          const userOperation = {
            ...prepared,
            // Some calls are estimated short (a swap, see `swapCallGas`): a floor keeps them whole.
            callGasLimit: minCallGas !== undefined && estimated < minCallGas ? minCallGas : estimated,
            signature: "0x"
          } as UserOperation<"0.7">
          const hash = getUserOperationHash({
            userOperation,
            entryPointAddress: account.entryPoint.address,
            entryPointVersion: "0.7",
            chainId: deployment.chainId
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
        return toReceipt(receipt)
      })

      return OwnerOperations.of({ account: (passkey) => kernelAccount(passkey), prepare, send, wait })
    })
  )
}
