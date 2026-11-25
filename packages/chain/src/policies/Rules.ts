/**
 * The catalog's rule policies as `TradeGuard` runs them: each rule's contract, its configuration encoded from the
 * spec, and a sentence for each error it reverts with. A new rule is a contract, a domain policy and one entry here.
 *
 * @since 0.0.0
 */
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { cashReserve } from "@bluechip/domain/policies/CashReserve"
import { fairPrice, pausedCollar } from "@bluechip/domain/policies/FairPrice"
import { configOf, type PolicyType } from "@bluechip/domain/policies/Policy"
import { band, OVERSHOOT_BPS, PROGRESS_BPS, rebalance } from "@bluechip/domain/policies/Rebalance"
import { SLIPPAGE_WINDOW_SECONDS, slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import type * as Schema from "effect/Schema"
import { type Abi, type Address, encodeAbiParameters, type Hex } from "viem"
import { stocks } from "../Contracts.ts"
import {
  cashReserveRule,
  cashReserveRuleAbi,
  fairPriceRule,
  fairPriceRuleAbi,
  rebalanceRule,
  rebalanceRuleAbi,
  slippageBudgetRule,
  slippageBudgetRuleAbi,
  stockCapRule,
  stockCapRuleAbi,
  tradeSizeRule,
  tradeSizeRuleAbi
} from "./Deployed.ts"

/**
 * A rule policy onchain: its contract, its configuration for `TradeGuard`, and what each of its errors means (`stock`
 * is the stock's name, when the error names one).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface RuleBinding {
  readonly policy: PolicyId
  readonly address: Address
  readonly abi: Abi
  readonly config: (spec: AgentSpec) => Hex
  readonly errors: Readonly<Record<string, (stock: string) => string>>
}

const encode = (components: ReadonlyArray<{ readonly type: string; readonly name: string }>, value: object): Hex =>
  encodeAbiParameters([{ type: "tuple", components }] as never, [value] as never)

/**
 * The configuration of `policy` in `spec`; throws when the spec doesn't carry it, which `checkSpec` rules out for the
 * policies a binding reads.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const required = <S extends Schema.Top>(spec: AgentSpec, policy: PolicyType<string, S>): S["Type"] => {
  const config = configOf(spec.policies, policy)
  if (config === undefined) throw new Error(`the spec has no ${policy.id} policy`)
  return config
}

/**
 * Every rule, in the order `TradeGuard` runs them (the catalog's).
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const RULES: ReadonlyArray<RuleBinding> = [
  {
    policy: "tradeSize",
    address: tradeSizeRule,
    abi: tradeSizeRuleAbi,
    config: (spec) => {
      const config = required(spec, tradeSize)
      return encode([{ type: "uint128", name: "minTrade" }, { type: "uint128", name: "maxTrade" }], {
        minTrade: config.minPerTrade,
        maxTrade: config.maxPerTrade
      })
    },
    errors: {
      TooSmall: () => "Smaller than the smallest trade it makes.",
      OverTradeSize: () => "Bigger than the largest trade it makes on its own."
    }
  },
  {
    policy: "fairPrice",
    address: fairPriceRule,
    abi: fairPriceRuleAbi,
    config: (spec) => {
      const config = required(spec, fairPrice)
      return encode([{ type: "uint16", name: "collarBps" }, { type: "uint16", name: "pausedCollarBps" }], {
        collarBps: config.collarBps,
        pausedCollarBps: pausedCollar(config)
      })
    },
    errors: { UnfairPrice: () => "Too far from Chainlink's price." }
  },
  {
    policy: "stockCap",
    address: stockCapRule,
    abi: stockCapRuleAbi,
    config: (spec) => encode([{ type: "uint16", name: "maxBps" }], { maxBps: required(spec, stockCap).maxBps }),
    errors: { OverStockCap: (stock) => `Would put too much of your money in ${stock}.` }
  },
  {
    policy: "cashReserve",
    address: cashReserveRule,
    abi: cashReserveRuleAbi,
    config: (spec) => encode([{ type: "uint16", name: "minBps" }], { minBps: required(spec, cashReserve).minBps }),
    errors: { UnderCashReserve: () => "Would leave too little in cash." }
  },
  {
    policy: "rebalance",
    address: rebalanceRule,
    abi: rebalanceRuleAbi,
    config: (spec) => {
      const config = required(spec, rebalance)
      const weight = (asset: string) => config.targets.find((target) => target.asset === asset)?.weight ?? 0
      return encode([
        { type: "uint16", name: "cashTargetBps" },
        { type: "uint16[]", name: "targetBps" },
        { type: "uint16", name: "bandBps" },
        { type: "uint16", name: "overshootBps" },
        { type: "uint16", name: "progressBps" },
        { type: "uint16", name: "collarBps" }
      ], {
        cashTargetBps: weight("USDC"),
        // By the guard's market index: every stock is valued.
        targetBps: stocks.map((stock) => weight(stock.symbol)),
        bandBps: band(config),
        overshootBps: OVERSHOOT_BPS,
        progressBps: PROGRESS_BPS,
        collarBps: required(spec, fairPrice).collarBps
      })
    },
    errors: {
      NotNeeded: () => "Your mix is already on target.",
      WrongWay: (stock) => `Would move ${stock} away from its target.`,
      Overshoots: (stock) => `Would push ${stock} past its target.`,
      NoProgress: () => "Wouldn't bring your mix closer to its target.",
      LosesValue: () => "Would lose too much value to prices.",
      TargetsMismatch: () => "Its target mix doesn't match the stocks it values."
    }
  },
  {
    policy: "slippageBudget",
    address: slippageBudgetRule,
    abi: slippageBudgetRuleAbi,
    config: (spec) =>
      encode([{ type: "uint16", name: "budgetBps" }, { type: "uint32", name: "window" }], {
        budgetBps: required(spec, slippageBudget).weeklyBps,
        window: SLIPPAGE_WINDOW_SECONDS
      }),
    errors: { OverSlippageBudget: () => "Would lose more to prices than this week's budget allows." }
  }
]
