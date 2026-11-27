/**
 * What an agent has counted onchain, policy by policy: USDC put into buys this UTC day (`AerodromeTradePolicy`) and
 * value lost to prices over the last seven days (`SlippageBudgetRule`'s ledger, decayed), in any of its sessions; and
 * Namera's trade count and gas this UTC day, in its session in force.
 *
 * @since 0.0.0
 */
import { PolicyUsage } from "@bluechip/domain/agents/Agent"
import { Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { slippageUsed } from "@bluechip/domain/policies/SlippageBudget"
import { trade } from "@bluechip/domain/policies/Trade"
import * as SessionHook from "@namera-ai/contracts/SessionHook"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Grant from "@namera-ai/sdk/Grant"
import * as Effect from "effect/Effect"
import { type Address, encodeAbiParameters, encodePacked, type Hex, keccak256 } from "viem"
import { ChainClient } from "../ChainClient.ts"
import { aerodromeTradePolicyAbi, slippageBudgetRuleAbi } from "./Deployed.ts"
import { required } from "./Rules.ts"

/**
 * What each counting policy of `spec` has used at `now` (Unix seconds), for the session `grant` on `account`.
 *
 * @stability experimental
 * @category reads
 * @since 0.0.0
 */
export const readUsage = Effect.fnUntraced(function*(options: {
  readonly spec: AgentSpec
  /** The agent's key (`agentKey`), which keys its rules' state. */
  readonly agent: Hex
  readonly account: Address
  readonly grant: Grant.Grant
  readonly now: number
}) {
  const chain = yield* ChainClient
  const { aerodromeTradePolicy, slippageBudgetRule, tradeGuard } = chain.deployment.policies

  // Policies are configured under the account's id of the session's policies (Smart Sessions' `configId`); the trade
  // policy finds the agent's day through it. TradeGuard keys its rules' state by the agent under SessionHook.
  const sessionConfigId = keccak256(encodePacked(["address", "bytes32"], [options.account, options.grant.id]))
  const ruleKey = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [
    options.agent,
    SessionHook.addressV1
  ]))
  const carries = (id: string) => options.spec.policies.some((entry) => entry.id === id)

  const [spent, ledger, status] = yield* chain.use("agent usage", (client) =>
    Promise.all([
      client.readContract({
        address: aerodromeTradePolicy,
        abi: aerodromeTradePolicyAbi,
        functionName: "spent",
        args: [sessionConfigId, SmartSession.addressV1, options.account, BigInt(options.now)]
      }),
      carries("slippageBudget") ?
        client.readContract({
          address: slippageBudgetRule,
          abi: slippageBudgetRuleAbi,
          functionName: "ledger",
          args: [tradeGuard, ruleKey, options.account]
        }) :
        undefined,
      Grant.getStatus(client, { grant: options.grant })
    ]))

  const limit = (kind: "rateLimit" | "gas") => status.limits.find((candidate) => candidate.kind === kind)
  const trades = limit("rateLimit")
  const gas = limit("gas")
  return [
    new PolicyUsage({ policy: "trade", unit: "usd", used: spent, limit: required(options.spec, trade).dailyBudget }),
    ...(ledger === undefined ? [] : [
      new PolicyUsage({
        policy: "slippageBudget",
        unit: "usd",
        used: slippageUsed({ used: Usdc.make(ledger[0]), updatedAt: Number(ledger[1]) }, options.now),
        limit: null
      })
    ]),
    new PolicyUsage({
      policy: "tradesPerDay",
      unit: "count",
      used: trades?.used ?? BigInt(0),
      limit: trades?.budget ?? null
    }),
    new PolicyUsage({ policy: "gasBudget", unit: "wei", used: gas?.used ?? BigInt(0), limit: gas?.budget ?? null })
  ]
})
