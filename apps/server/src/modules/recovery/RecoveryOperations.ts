import type { Call } from "@bluechip/chain/account/Owners"
import { guardSession, recoverySession } from "@bluechip/chain/account/Recovery"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { lockedGrant } from "@bluechip/chain/policies/Session"
import { Unavailable } from "@bluechip/domain/Errors"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import * as Grant from "@namera-ai/sdk/Grant"
import * as Session from "@namera-ai/sdk/Session"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type Address, encodeAbiParameters, type Hex, keccak256, type LocalAccount } from "viem"
import {
  formatUserOperation,
  formatUserOperationRequest,
  getUserOperationHash,
  type RpcUserOperation,
  type SmartAccount,
  toWebAuthnAccount,
  type UserOperation
} from "viem/account-abstraction"
import { AppConfig } from "../../config/AppConfig.ts"
import { Namera } from "../../platform/namera/Namera.ts"
import { OwnerOperations, type OwnerPasskey } from "../signing/OwnerOperations.ts"

/** A passkey as the recovery session holds it. */
export interface RecoveryPasskey {
  readonly credentialId: string
  readonly publicKey: string
}

/**
 * The recovery's onchain operations, sent through Namera sessions rather than by an owner: the recovery passkey's
 * (prepared here, signed in the browser like an owner operation, then sent) and the guard's (signed here with its
 * key). Their sessions are built again from what is stored, so their grants never need storing.
 */
export class RecoveryOperations extends Context.Service<RecoveryOperations, {
  /** The recovery passkey's and the guard's sessions, as `setupCalls` locks them. */
  readonly sessions: (input: {
    readonly id: string
    readonly recoveryKey: Hex
    readonly guard: Address
  }) => { readonly recovery: Session.Session; readonly guard: Session.Session }
  /** The grant of a session locked on the owner's account. */
  readonly grant: (owner: OwnerPasskey, session: Session.Session) => Effect.Effect<Grant.Grant, Unavailable>
  /**
   * Builds the recovery passkey's operation of `calls`, and what the passkey signs: the operation's hash bound to the
   * session (`keccak256(abi.encode(userOpHash, permissionId))`), which Smart Sessions verifies.
   */
  readonly prepare: (
    grant: Grant.Grant,
    passkey: RecoveryPasskey,
    calls: ReadonlyArray<Call>
  ) => Effect.Effect<{ readonly userOperation: Record<string, unknown>; readonly challenge: Hex }, Unavailable>
  /** Sends a prepared operation with the recovery passkey's assertion; returns its hash. */
  readonly send: (
    grant: Grant.Grant,
    passkey: RecoveryPasskey,
    prepared: Record<string, unknown>,
    assertion: typeof AuthenticationCredential.Type
  ) => Effect.Effect<Hex, Unavailable>
  /** Sends `calls` as the guard, signed with its key; returns the operation's hash. */
  readonly sendAsGuard: (
    grant: Grant.Grant,
    key: LocalAccount,
    calls: ReadonlyArray<Call>
  ) => Effect.Effect<Hex, Unavailable>
}>()("@bluechip/server/RecoveryOperations") {
  static readonly layer = Layer.effect(
    RecoveryOperations,
    Effect.gen(function*() {
      const config = yield* AppConfig
      const chain = yield* ChainClient
      const deployment = yield* ChainDeployment
      const namera = yield* Namera
      const owners = yield* OwnerOperations

      const unavailable = (cause: unknown) =>
        Effect.andThen(
          Effect.logWarning("Recovery operation failed", cause),
          Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: null }))
        )

      // The recovery passkey as viem's WebAuthn account: `assertion` is what the browser signed.
      const sessionAccount = (
        grant: Grant.Grant,
        passkey: RecoveryPasskey,
        assertion?: typeof AuthenticationCredential.Type
      ) =>
        Effect.tryPromise(() =>
          Grant.toAccount(chain.client, {
            grant,
            check: false,
            signer: toWebAuthnAccount({
              credential: { id: passkey.credentialId, publicKey: passkey.publicKey as Hex },
              rpId: config.rpId,
              getFn: async () => {
                if (assertion === undefined) throw new Error("the recovery passkey signs in the browser")
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
        ).pipe(Effect.catch(unavailable))

      // Straight to the bundler: viem's `sendUserOperation` would prepare (and re-estimate) the operation again.
      const sendSigned = (account: SmartAccount, userOperation: UserOperation<"0.7">) =>
        Effect.tryPromise(async () => {
          const signature = await account.signUserOperation(userOperation)
          return await namera.bundlerClient(account).request({
            method: "eth_sendUserOperation",
            params: [formatUserOperationRequest({ ...userOperation, signature }), account.entryPoint.address]
          })
        }).pipe(Effect.catch(unavailable))

      const prepare = Effect.fn("RecoveryOperations.prepare")(
        function*(grant: Grant.Grant, passkey: RecoveryPasskey, calls: ReadonlyArray<Call>) {
          const account = yield* sessionAccount(grant, passkey)
          const prepared = yield* Effect.tryPromise(() =>
            namera.bundlerClient(account).prepareUserOperation({ account, calls: [...calls] })
          ).pipe(Effect.catch(unavailable))
          const userOperation = { ...prepared, signature: "0x" } as UserOperation<"0.7">
          const hash = getUserOperationHash({
            userOperation,
            entryPointAddress: account.entryPoint.address,
            entryPointVersion: "0.7",
            chainId: deployment.chainId
          })
          const challenge = keccak256(
            encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [
              hash,
              Session.getPermissionId(grant.session)
            ])
          )
          return { userOperation: formatUserOperationRequest(userOperation) as Record<string, unknown>, challenge }
        }
      )

      const send = Effect.fn("RecoveryOperations.send")(function*(
        grant: Grant.Grant,
        passkey: RecoveryPasskey,
        prepared: Record<string, unknown>,
        assertion: typeof AuthenticationCredential.Type
      ) {
        const account = yield* sessionAccount(grant, passkey, assertion)
        const userOperation = formatUserOperation(prepared as unknown as RpcUserOperation<"0.7">) as UserOperation<
          "0.7"
        >
        return yield* sendSigned(account, userOperation)
      })

      const sendAsGuard = Effect.fn("RecoveryOperations.sendAsGuard")(
        function*(grant: Grant.Grant, key: LocalAccount, calls: ReadonlyArray<Call>) {
          const account = yield* Effect.tryPromise(() =>
            Grant.toAccount(chain.client, { grant, signer: key, check: false })
          ).pipe(Effect.catch(unavailable))
          return yield* Effect.tryPromise(() =>
            namera.bundlerClient(account).sendUserOperation({ account, calls: [...calls] })
          ).pipe(Effect.catch(unavailable))
        }
      )

      const grant = Effect.fn("RecoveryOperations.grant")(function*(owner: OwnerPasskey, session: Session.Session) {
        const account = yield* owners.account(owner)
        return yield* lockedGrant(account, session).pipe(
          Effect.provideService(ChainClient, chain),
          Effect.catch(unavailable)
        )
      })

      return RecoveryOperations.of({
        sessions: ({ guard, id, recoveryKey }) => ({
          recovery: recoverySession({ deployment, publicKey: recoveryKey, id }),
          guard: guardSession({ deployment, signer: guard, id })
        }),
        grant,
        prepare,
        send,
        sendAsGuard
      })
    })
  )
}
