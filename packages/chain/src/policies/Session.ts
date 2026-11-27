/**
 * An agent's Namera session from its spec: the policies its key carries (compiled from the catalog), the owner's calls
 * that lock it, change it (swapping only the onchain policies that changed) or renew it with a new key, and the grant
 * the agent trades with.
 *
 * @since 0.0.0
 */
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { gasBudget } from "@bluechip/domain/policies/GasBudget"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import * as AllowPolicy from "@namera-ai/contracts/AllowPolicy"
import * as GasPolicy from "@namera-ai/contracts/GasPolicy"
import * as RateLimitPolicy from "@namera-ai/contracts/RateLimitPolicy"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import type * as SmartAccount from "@namera-ai/sdk/accounts/SmartAccount"
import * as Grant from "@namera-ai/sdk/Grant"
import * as SessionKey from "@namera-ai/sdk/keys/SessionKey"
import * as Policy from "@namera-ai/sdk/Policy"
import * as Session from "@namera-ai/sdk/Session"
import * as Effect from "effect/Effect"
import { type Address, encodeFunctionData, type Hex } from "viem"
import { ChainClient } from "../ChainClient.ts"
import type { Deployment } from "../Deployment.ts"
import { swapCallGas } from "../market/Swaps.ts"
import { encodeGuardConfig, guardConfig } from "./Guard.ts"
import { required, RULES } from "./Rules.ts"
import { tradePolicyInitData } from "./Trade.ts"

/**
 * The least call gas an agent's operation of `swaps` swaps asks for: each swap's (`swapCallGas`, estimates of which
 * come in short) and TradeGuard's checks around them, made once per operation.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const guardedCallGas = (swaps: number): bigint => swapCallGas * BigInt(Math.max(1, swaps)) + BigInt(600_000)

/**
 * The least call gas an agent's trade of one swap asks for.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const guardedTradeCallGas = guardedCallGas(1)

/**
 * Where a policy of the spec is enforced: the session's user operation policy, its fallback action, its execution
 * policy, or a rule the execution policy runs; and the contract that does it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Placement {
  readonly policy: PolicyId
  readonly kind: "userOp" | "action" | "execution" | "rule"
  readonly contract: Address
}

/**
 * Where each policy of `spec` is enforced on `deployment`, in the spec's order.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const placements = (deployment: Deployment, spec: AgentSpec): ReadonlyArray<Placement> =>
  spec.policies.map((entry): Placement => {
    const rule = RULES.find((candidate) => candidate.policy === entry.id)
    if (rule !== undefined) return { policy: entry.id, kind: "rule", contract: deployment.policies[rule.contract] }
    switch (entry.id) {
      case "trade":
        return { policy: entry.id, kind: "userOp", contract: deployment.policies.aerodromeTradePolicy }
      case "tradesPerDay":
        return { policy: entry.id, kind: "userOp", contract: RateLimitPolicy.addressV1 }
      case "gasBudget":
        return { policy: entry.id, kind: "userOp", contract: GasPolicy.addressV1 }
      default:
        return { policy: entry.id, kind: "action", contract: AllowPolicy.addressV1 }
    }
  })

/**
 * The Namera policies of a session for `spec`: calls pass Namera's `AllowPolicy` (`Policy.anyCall`), since
 * `AerodromeTradePolicy` checks every call of every operation more strictly than an allowlist would; `TradeGuard`
 * runs around each operation with the spec's rules; then the daily trade count and gas budget. Experimental, as
 * Namera's policies are.
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const compileSession = (deployment: Deployment, spec: AgentSpec): ReadonlyArray<Policy.Policy> => [
  Policy.anyCall({ unsafe: true }),
  Policy.custom({
    kind: "limit",
    address: deployment.policies.aerodromeTradePolicy,
    initData: tradePolicyInitData(deployment, spec)
  }),
  Policy.execution({
    address: deployment.policies.tradeGuard,
    initData: encodeGuardConfig(guardConfig(deployment, spec))
  }),
  Policy.rateLimit({ count: required(spec, tradesPerDay).count, period: "day" }),
  Policy.gas({ maxCost: required(spec, gasBudget).weiPerDay, period: "day" })
]

const keyOf = (policy: Policy.Policy) =>
  JSON.stringify(policy, (_, value) => (typeof value === "bigint" ? value.toString() : value))

/**
 * The onchain policies a change from `before` to `after` removes and adds: only those whose configuration changed, so
 * counters kept by the others (the daily budget, the trade count) carry over.
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const diffSessions = (deployment: Deployment, before: AgentSpec, after: AgentSpec): {
  readonly remove: ReadonlyArray<Policy.Policy>
  readonly add: ReadonlyArray<Policy.Policy>
} => {
  const old = compileSession(deployment, before)
  const next = compileSession(deployment, after)
  const oldKeys = old.map(keyOf)
  const nextKeys = next.map(keyOf)
  return {
    remove: old.filter((policy) => !nextKeys.includes(keyOf(policy))),
    add: next.filter((policy) => !oldKeys.includes(keyOf(policy)))
  }
}

/**
 * The session `signer` signs in with `spec`'s policies until `validUntil` (Unix seconds). Its permission id depends on
 * `salt`: pass the same salt to build the same session again (Namera picks a random one otherwise).
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const agentSession = (options: {
  readonly deployment: Deployment
  readonly spec: AgentSpec
  readonly signer: Address
  readonly validUntil: number
  readonly salt?: Hex | undefined
}): Session.Session =>
  Session.from({
    signer: SessionKey.ecdsa(options.signer),
    validUntil: options.validUntil,
    policies: compileSession(options.deployment, options.spec),
    ...(options.salt === undefined ? {} : { salt: options.salt })
  })

/**
 * The owner's call that locks a session: Smart Sessions' `enableSessions`, sent from the account. It must be the
 * owner's operation, not the agent's first one, since `TradeGuard` deploys its configuration as it is set.
 *
 * @stability experimental
 * @category encoding
 * @since 0.0.0
 */
export const lockCalls = (session: Session.Session): ReadonlyArray<{ readonly to: Address; readonly data: Hex }> => [{
  to: SmartSession.addressV1,
  data: encodeFunctionData({
    abi: SmartSession.abiV1,
    functionName: "enableSessions",
    args: [[Session.toSmartSession(session) as never]]
  })
}]

/**
 * The owner's calls that change a locked session's policies from `before` to `after` (`diffSessions`), and the
 * session as it will be.
 *
 * @stability experimental
 * @category encoding
 * @since 0.0.0
 */
export const changeCalls = (deployment: Deployment, grant: Grant.Grant, before: AgentSpec, after: AgentSpec) => {
  const update = Grant.updateCalls(grant, diffSessions(deployment, before, after))
  return { calls: ownerCalls(update.calls), session: update.session }
}

/**
 * The owner's calls that renew an agent: lock `session` (a new key) and revoke the grant in force, in one operation.
 *
 * @stability experimental
 * @category encoding
 * @since 0.0.0
 */
export const renewCalls = (grant: Grant.Grant, session: Session.Session) => [
  ...lockCalls(session),
  ...ownerCalls(Grant.revokeCalls(grant))
]

/**
 * The owner's calls that revoke a grant.
 *
 * @stability experimental
 * @category encoding
 * @since 0.0.0
 */
export const revokeCalls = (grant: Grant.Grant) => ownerCalls(Grant.revokeCalls(grant))

// Namera's owner calls send no value, and always carry data.
const ownerCalls = (calls: ReadonlyArray<{ readonly to: Hex; readonly data?: Hex | undefined }>) =>
  calls.map((call) => ({ to: call.to, data: call.data ?? "0x" as Hex }))

/**
 * The grant of a session the owner locked with `lockCalls`, for the agent to trade with and the owner to change or
 * revoke: an installed grant, with no enable signature, so the agent always uses the enabled session.
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const lockedGrant = Effect.fnUntraced(function*(owner: SmartAccount.SmartAccount, session: Session.Session) {
  const chain = yield* ChainClient
  const prepared = yield* chain.use("prepare grant", () => Grant.prepare({ account: owner, session }))
  return Grant.parse({
    version: 1,
    namespace: "eip155",
    id: Session.getPermissionId(session),
    account: prepared.account,
    accountType: prepared.accountType,
    session,
    chains: prepared.chains.map((entry) => ({ ...entry, signature: "0x" })),
    summary: Session.describe(session)
  })
})

/**
 * A grant after a change landed: the same grant with the changed session.
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const changedGrant = (grant: Grant.Grant, session: Session.Session): Grant.Grant =>
  Grant.parse({ ...grant, session, summary: Grant.describe({ ...grant, session }) })
