/**
 * An agent's Namera session on Base: built from its limits and its key, locked by one owner call to Smart Sessions,
 * and what its policies have counted so far.
 *
 * @since 0.0.0
 */
import type { Limits } from "@bluechip/domain/agents/Limits"
import { policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import { slippageUsed } from "@bluechip/domain/agents/TradeMath"
import { Usdc } from "@bluechip/domain/market/Units"
import * as SessionHook from "@namera-ai/contracts/SessionHook"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import type * as SmartAccount from "@namera-ai/sdk/accounts/SmartAccount"
import * as Grant from "@namera-ai/sdk/Grant"
import * as SessionKey from "@namera-ai/sdk/keys/SessionKey"
import * as Session from "@namera-ai/sdk/Session"
import * as Effect from "effect/Effect"
import { type Address, encodeAbiParameters, encodeFunctionData, encodePacked, type Hex, keccak256 } from "viem"
import { ChainClient } from "../ChainClient.ts"
import { aerodromeTradePolicy, aerodromeTradePolicyAbi, tradeGuard, tradeGuardAbi } from "./Deployed.ts"
import { sessionPolicies } from "./Policies.ts"

/**
 * The session an agent's key signs in, with the four policies its limits make, until `validUntil` (Unix seconds).
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const agentSession = (options: {
  readonly limits: Limits
  readonly signer: Address
  readonly validUntil: number
}): Session.Session =>
  Session.from({
    signer: SessionKey.ecdsa(options.signer),
    validUntil: options.validUntil,
    policies: sessionPolicies(policyConfig(options.limits))
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
 * What an agent's session has counted onchain at `now` (Unix seconds): USDC put into buys this UTC day
 * (`AerodromeTradePolicy`) and value lost to prices over the last 7 days (`TradeGuard`'s ledger, decayed).
 *
 * @stability experimental
 * @category reads
 * @since 0.0.0
 */
export const readUsage = Effect.fnUntraced(function*(options: {
  readonly account: Address
  readonly permissionId: Hex
  readonly now: number
}) {
  const chain = yield* ChainClient
  // Both are keyed by the account's id of the session's policies (Smart Sessions' and SessionHook's `configId`);
  // TradeGuard is the session's first execution policy.
  const sessionConfigId = keccak256(encodePacked(["address", "bytes32"], [options.account, options.permissionId]))
  const guardConfigId = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [
    sessionConfigId,
    BigInt(0)
  ]))

  const [spent, [used, updatedAt]] = yield* chain.use("agent usage", (client) =>
    Promise.all([
      client.readContract({
        address: aerodromeTradePolicy,
        abi: aerodromeTradePolicyAbi,
        functionName: "spent",
        args: [sessionConfigId, SmartSession.addressV1, options.account, BigInt(options.now)]
      }),
      client.readContract({
        address: tradeGuard,
        abi: tradeGuardAbi,
        functionName: "ledger",
        args: [guardConfigId, SessionHook.addressV1, options.account]
      })
    ]))

  return {
    spentToday: Usdc.make(spent),
    slippageThisWeek: slippageUsed({ used: Usdc.make(used), updatedAt: Number(updatedAt) }, options.now)
  }
})
