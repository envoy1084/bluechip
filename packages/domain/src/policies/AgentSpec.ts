/**
 * An agent's definition: the onchain policies its session key carries, each with its configuration. The form, the
 * assistant and templates all produce one, and `checkSpec` accepts or refuses it the same way for each.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { anyCall } from "./AnyCall.ts"
import { cashReserve } from "./CashReserve.ts"
import { fairPrice } from "./FairPrice.ts"
import { gasBudget } from "./GasBudget.ts"
import { rebalance } from "./Rebalance.ts"
import { slippageBudget } from "./SlippageBudget.ts"
import { stockCap } from "./StockCap.ts"
import { stopLossFloor } from "./StopLossFloor.ts"
import { trade } from "./Trade.ts"
import { tradeSize } from "./TradeSize.ts"
import { tradesPerDay } from "./TradesPerDay.ts"

/**
 * Every policy in the catalog, in the order a session lists them (and `TradeGuard` runs its rules).
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const POLICIES = [
  trade,
  tradeSize,
  fairPrice,
  stockCap,
  cashReserve,
  rebalance,
  stopLossFloor,
  slippageBudget,
  tradesPerDay,
  gasBudget,
  anyCall
] as const

/**
 * A policy's id.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PolicyId = Schema.Literals(POLICIES.map((policy) => policy.id))

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PolicyId = typeof PolicyId.Type

/**
 * One policy of a session with its configuration.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PolicyEntry = Schema.Union(POLICIES.map((policy) => policy.entry))

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PolicyEntry = typeof PolicyEntry.Type

/**
 * The policies an agent's session key carries.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AgentSpec extends Schema.Class<AgentSpec>("@bluechip/domain/policies/AgentSpec/AgentSpec")({
  policies: Schema.Array(PolicyEntry)
}) {}

/**
 * Why a spec can't be locked, as a sentence about one policy and one of its fields (`null`: the policy as a whole).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PolicyProblem extends Schema.Class<PolicyProblem>("@bluechip/domain/policies/AgentSpec/PolicyProblem")({
  policy: PolicyId,
  field: Schema.NullOr(Schema.String),
  message: Schema.String
}) {}
