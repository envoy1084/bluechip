/**
 * `TradeGuard`'s configuration for a spec: the agent's direction, the price ages, every stock the portfolio is valued
 * over (with whether the agent may trade it), and the rules the spec carries, in the catalog's order.
 *
 * @since 0.0.0
 */
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { fairPrice, LIVE_PRICE_SECONDS, PAUSED_PRICE_SECONDS } from "@bluechip/domain/policies/FairPrice"
import { trade } from "@bluechip/domain/policies/Trade"
import { type Address, encodeAbiParameters, type Hex } from "viem"
import type { Deployment, Stock } from "../Deployment.ts"
import { required, RULES } from "./Rules.ts"
import { MODES } from "./Trade.ts"

/**
 * `TradeGuard.packMarkets` for every stock of a deployment: two words each, the token (with whether the agent may
 * trade it at bit 160), then its feed.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const packMarkets = (stocks: ReadonlyArray<Stock>, allowed: ReadonlyArray<string>): ReadonlyArray<bigint> =>
  stocks.flatMap((stock) => [
    BigInt(stock.token) | (allowed.includes(stock.symbol) ? BigInt(1) << BigInt(160) : BigInt(0)),
    BigInt(stock.feed)
  ])

/**
 * `TradeGuard.Config`: the direction, the price ages, the packed markets and the rules with their configurations.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface GuardConfig {
  readonly mode: number
  readonly prices: { readonly tradeWhilePaused: boolean; readonly liveAge: number; readonly pausedAge: number }
  readonly markets: ReadonlyArray<bigint>
  readonly rules: ReadonlyArray<{ readonly rule: Address; readonly config: Hex }>
}

/**
 * `TradeGuard`'s configuration for `spec` on `deployment`.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const guardConfig = (deployment: Deployment, spec: AgentSpec): GuardConfig => {
  const config = required(spec, trade)
  const carried = spec.policies.map((entry) => entry.id)
  return {
    mode: MODES[config.direction],
    prices: {
      tradeWhilePaused: required(spec, fairPrice).tradeWhilePaused,
      liveAge: LIVE_PRICE_SECONDS,
      pausedAge: PAUSED_PRICE_SECONDS
    },
    markets: packMarkets(deployment.stocks, config.stocks),
    rules: RULES.filter((rule) => carried.includes(rule.policy)).map((rule) => ({
      rule: deployment.policies[rule.contract],
      config: rule.config(spec, deployment.stocks)
    }))
  }
}

/**
 * `TradeGuard`'s init data: `abi.encode(mode, prices, markets, rules)`.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const encodeGuardConfig = (config: GuardConfig): Hex =>
  encodeAbiParameters([
    { type: "uint8" },
    {
      type: "tuple",
      components: [
        { type: "bool", name: "tradeWhilePaused" },
        { type: "uint32", name: "liveAge" },
        { type: "uint32", name: "pausedAge" }
      ]
    },
    { type: "uint256[]" },
    { type: "tuple[]", components: [{ type: "address", name: "rule" }, { type: "bytes", name: "config" }] }
  ], [config.mode, config.prices, config.markets, config.rules])
