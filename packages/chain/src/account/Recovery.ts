/**
 * Account recovery with a recovery passkey: a Namera session whose key is that passkey and which may change the
 * account's owners only through `RecoveryDelayPolicy`, so every change waits 48 hours after the account asked for it
 * (the EntryPoint refuses it earlier). A second session, the guard's, may only cancel a request, so bluechip can cancel
 * one for you from a signed-in device or a chat without Face ID.
 *
 * @since 0.0.0
 */
import * as WebAuthnValidator from "@namera-ai/contracts/WebAuthnValidator"
import * as SessionKey from "@namera-ai/sdk/keys/SessionKey"
import * as Policy from "@namera-ai/sdk/Policy"
import * as Session from "@namera-ai/sdk/Session"
import * as Effect from "effect/Effect"
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  parseEther,
  stringToHex,
  toFunctionSelector
} from "viem"
import { ChainClient } from "../ChainClient.ts"
import type { Deployment } from "../Deployment.ts"
import { recoveryDelayPolicyAbi } from "../policies/Deployed.ts"
import { lockCalls } from "../policies/Session.ts"
import { addOwnerCall, type Call, removeOwnerCall } from "./Owners.ts"

/**
 * How long a recovery waits after it is requested: 48 hours.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const RECOVERY_DELAY_SECONDS = 48 * 60 * 60

/**
 * The hash a recovery request names a call by, as `RecoveryDelayPolicy.callHash` computes it.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const callHashOf = (call: Call): Hex =>
  keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes" }], [call.to, call.data]))

/**
 * The owner changes a recovery makes: the new passkey becomes an owner, then each of the old ones is removed.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const recoveryCalls = (options: {
  readonly newOwner: Hex
  readonly oldOwners: ReadonlyArray<Hex>
}): ReadonlyArray<Call> => [addOwnerCall(options.newOwner), ...options.oldOwners.map(removeOwnerCall)]

const delayCall = (deployment: Deployment, functionName: "request" | "cancel", calls: ReadonlyArray<Call>): Call => ({
  to: deployment.policies.recoveryDelayPolicy,
  data: encodeFunctionData({ abi: recoveryDelayPolicyAbi, functionName, args: [calls.map(callHashOf)] })
})

/**
 * The account's call that asks for `calls`: each may run once the delay has passed.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const requestCall = (deployment: Deployment, calls: ReadonlyArray<Call>): Call =>
  delayCall(deployment, "request", calls)

/**
 * The account's call that cancels the request for `calls`.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const cancelCall = (deployment: Deployment, calls: ReadonlyArray<Call>): Call =>
  delayCall(deployment, "cancel", calls)

const selectorOf = (name: "addPasskey" | "removePasskey") => {
  const entry = WebAuthnValidator.abiV1.find((item) => item.type === "function" && item.name === name)!
  return toFunctionSelector(entry as never)
}

const delaySelector = (name: "request" | "cancel") =>
  toFunctionSelector(recoveryDelayPolicyAbi.find((item) => item.type === "function" && item.name === name) as never)

// The gas either session may spend in a day, paid by the account: a few operations at Base's prices, never more.
const dailyGas = Policy.gas({ maxCost: parseEther("0.002"), period: "day" })

const delayed = (deployment: Deployment, name: "addPasskey" | "removePasskey") =>
  Policy.custom({
    kind: "call",
    address: deployment.policies.recoveryDelayPolicy,
    initData: encodeAbiParameters([{ type: "uint256" }], [BigInt(RECOVERY_DELAY_SECONDS)]),
    to: WebAuthnValidator.addressV1,
    selector: selectorOf(name)
  })

/**
 * The recovery passkey's session: it may ask for owner changes and make them once they are due. It has no end, so a
 * recovery passkey kept in a drawer still works; removing it revokes the session. `id` (the recovery key's row) is
 * its salt, so the same session can be built again to read its grant.
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const recoverySession = (
  options: { readonly deployment: Deployment; readonly publicKey: Hex; readonly id: string }
): Session.Session =>
  Session.from({
    signer: SessionKey.passkey({ publicKey: options.publicKey }),
    validUntil: "never",
    unsafe: true,
    salt: keccak256(stringToHex(`recovery:${options.id}`)),
    policies: [
      Policy.call({ to: options.deployment.policies.recoveryDelayPolicy, selector: delaySelector("request") }),
      delayed(options.deployment, "addPasskey"),
      delayed(options.deployment, "removePasskey"),
      dailyGas
    ]
  })

/**
 * The guard's session: its key, kept by bluechip, may only cancel a recovery request.
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const guardSession = (
  options: { readonly deployment: Deployment; readonly signer: Address; readonly id: string }
): Session.Session =>
  Session.from({
    signer: SessionKey.ecdsa(options.signer),
    validUntil: "never",
    unsafe: true,
    salt: keccak256(stringToHex(`guard:${options.id}`)),
    policies: [
      Policy.call({ to: options.deployment.policies.recoveryDelayPolicy, selector: delaySelector("cancel") }),
      dailyGas
    ]
  })

/**
 * The owner's calls that set up recovery: both sessions, locked in one operation.
 *
 * @stability experimental
 * @category encoding
 * @since 0.0.0
 */
export const setupCalls = (recovery: Session.Session, guard: Session.Session) => [
  ...lockCalls(recovery),
  ...lockCalls(guard)
]

/**
 * When the account asked for `call`, in Unix seconds, or `undefined` when there is no such request (never asked,
 * cancelled, or used).
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const requestedAt = Effect.fnUntraced(function*(account: Address, call: Call) {
  const chain = yield* ChainClient
  const at = yield* chain.use("read a recovery request", (client) =>
    client.readContract({
      address: chain.deployment.policies.recoveryDelayPolicy,
      abi: recoveryDelayPolicyAbi,
      functionName: "requestedAt",
      args: [account, callHashOf(call)]
    }))
  return at === BigInt(0) ? undefined : Number(at)
})
