/**
 * The `trade` policy onchain: `AerodromeTradePolicy` as the session's user operation policy, with the agent's stocks
 * and their pools, its direction, the most USDC per buy (the trade size policy's largest trade) and per UTC day.
 *
 * @since 0.0.0
 */
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { type Direction, trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { encodeAbiParameters, type Hex } from "viem"
import type { Deployment, Stock } from "../Deployment.ts"
import { required } from "./Rules.ts"

/**
 * The contracts' number for each direction.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MODES: Readonly<Record<Direction, number>> = { buy: 0, sell: 1, both: 2, rebalance: 3 }

/**
 * The stock of `deployment` with this symbol.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const stockOf = (deployment: Deployment, symbol: string): Stock => {
  const stock = deployment.stocks.find((candidate) => candidate.symbol === symbol)
  if (stock === undefined) throw new Error(`no stock ${symbol}`)
  return stock
}

/**
 * `AerodromeTradePolicy`'s init data for `spec` on `deployment`: its settings, then the agent (`agentKey`), which keys
 * the day's spending so every session of one agent shares it.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const tradePolicyInitData = (deployment: Deployment, spec: AgentSpec, agent: Hex): Hex => {
  const config = required(spec, trade)
  return encodeAbiParameters([{
    type: "tuple",
    components: [
      { type: "uint8", name: "mode" },
      { type: "uint128", name: "maxUsdcIn" },
      { type: "uint128", name: "dailyBudget" },
      {
        type: "tuple[]",
        name: "markets",
        components: [{ type: "address", name: "token" }, { type: "int24", name: "tickSpacing" }]
      }
    ]
  }, { type: "bytes32" }], [{
    mode: MODES[config.direction],
    maxUsdcIn: required(spec, tradeSize).maxPerTrade,
    dailyBudget: config.dailyBudget,
    markets: config.stocks.map((symbol) => ({
      token: stockOf(deployment, symbol).token,
      tickSpacing: stockOf(deployment, symbol).pool?.tickSpacing ?? 0
    }))
  }, agent])
}
