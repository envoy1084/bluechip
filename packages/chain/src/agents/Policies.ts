/**
 * An agent's onchain policies from its limits: bluechip's validation policy (`AerodromeTradePolicy`), its execution
 * policy (`TradeGuard`), and Namera's rate and gas limits, as the Namera policies a session is built from. The
 * numbers come from `policyConfig` in the domain; the token and feed addresses are added here.
 *
 * @since 0.0.0
 */
import type { PolicyConfig } from "@bluechip/domain/agents/PolicyConfig"
import * as Policy from "@namera-ai/sdk/Policy"
import { type Address, encodeAbiParameters, erc20Abi, type Hex, toFunctionSelector } from "viem"
import { stocks, usdc } from "../Contracts.ts"
import { swapRouter, swapRouterAbi } from "../market/Aerodrome.ts"
import { swapCallGas } from "../market/Swaps.ts"
import { aerodromeTradePolicy, tradeGuard } from "./Deployed.ts"

/**
 * The most gas an agent may spend per UTC day, in wei, sponsored operations included: about 100 trades on Base.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DAILY_GAS_WEI = BigInt(10) ** BigInt(15)

/**
 * The least call gas an agent's trade asks for: a swap's (`swapCallGas`, estimates of which come in short) and
 * TradeGuard's checks around it.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const guardedTradeCallGas = swapCallGas + BigInt(600_000)

const MODES = { buy: 0, sell: 1, both: 2, rebalance: 3 } as const

const stockOf = (symbol: string) => {
  const stock = stocks.find((candidate) => candidate.symbol === symbol)
  if (stock === undefined) throw new Error(`no stock ${symbol}`)
  return stock
}

/**
 * The ABI of `GuardRules.Settings`.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const guardSettingsAbi = [
  { type: "uint8", name: "mode" },
  { type: "bool", name: "tradeWhilePaused" },
  { type: "uint16", name: "collarBps" },
  { type: "uint16", name: "pausedCollarBps" },
  { type: "uint32", name: "liveAge" },
  { type: "uint32", name: "pausedAge" },
  { type: "uint128", name: "minTradeUsd" },
  { type: "uint128", name: "maxTradeUsd" },
  { type: "uint16", name: "maxInOneStockBps" },
  { type: "uint16", name: "cashReserveBps" },
  { type: "uint16", name: "weeklySlippageBps" },
  { type: "uint32", name: "slippageWindow" },
  { type: "uint16", name: "bandBps" },
  { type: "uint16", name: "overshootBps" },
  { type: "uint16", name: "progressBps" },
  { type: "uint16", name: "cashTargetBps" }
] as const

const targetOf = (config: PolicyConfig, asset: string) =>
  config.guard.targets.find((target) => target.asset === asset)?.weight ?? 0

/**
 * `GuardRules.Settings` for an agent's configuration.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const guardSettings = (config: PolicyConfig) => {
  const { guard } = config
  return {
    mode: MODES[guard.mode],
    tradeWhilePaused: guard.tradeWhilePaused,
    collarBps: guard.collarBps,
    pausedCollarBps: guard.pausedCollarBps,
    liveAge: guard.liveAgeSeconds,
    pausedAge: guard.pausedAgeSeconds,
    minTradeUsd: guard.minTradeUsd,
    maxTradeUsd: guard.maxTradeUsd,
    maxInOneStockBps: guard.maxInOneStockBps,
    cashReserveBps: guard.cashReserveBps,
    weeklySlippageBps: guard.weeklySlippageBps,
    slippageWindow: guard.slippageWindowSeconds,
    bandBps: guard.bandBps,
    overshootBps: guard.overshootBps,
    progressBps: guard.progressBps,
    cashTargetBps: targetOf(config, "USDC")
  }
}

/**
 * `TradeGuard`'s init data: its settings and every stock the portfolio is valued over, with its feed, whether the
 * agent may trade it and its target.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const tradeGuardInitData = (config: PolicyConfig): Hex =>
  encodeAbiParameters([{
    type: "tuple",
    components: [
      { type: "tuple", name: "settings", components: guardSettingsAbi },
      {
        type: "tuple[]",
        name: "markets",
        components: [
          { type: "address", name: "token" },
          { type: "address", name: "feed" },
          { type: "bool", name: "allowed" },
          { type: "uint16", name: "targetBps" }
        ]
      }
    ]
  }], [{
    settings: guardSettings(config),
    markets: config.guard.valued.map((symbol) => {
      const stock = stockOf(symbol)
      return {
        token: stock.token,
        feed: stock.feed,
        allowed: config.guard.allowed.includes(symbol),
        targetBps: targetOf(config, symbol)
      }
    })
  }])

/**
 * `AerodromeTradePolicy`'s init data as the session's user operation policy: the agent's direction, the most per buy
 * and per day, and its stocks with their pools' tick spacing.
 *
 * @stability unstable
 * @category encoding
 * @since 0.0.0
 */
export const tradeOperationInitData = (config: PolicyConfig): Hex =>
  encodeAbiParameters([{ type: "uint8" }, {
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
  }], [1, {
    mode: MODES[config.trade.mode],
    maxUsdcIn: config.trade.maxUsdcIn,
    dailyBudget: config.trade.dailyBudget,
    markets: config.trade.stocks.map((symbol) => ({
      token: stockOf(symbol).token,
      tickSpacing: stockOf(symbol).pool?.tickSpacing ?? 0
    }))
  }])

const ACTION_INIT_DATA = encodeAbiParameters([{ type: "uint8" }], [0])
const APPROVE = toFunctionSelector(erc20Abi.find((item) => item.name === "approve")!)
const EXACT_INPUT_SINGLE = toFunctionSelector(swapRouterAbi.find((item) => item.name === "exactInputSingle")!)

/**
 * The Namera policies of an agent's session: `AerodromeTradePolicy` on the router's swap and on `approve` of USDC
 * and each of the agent's stocks, and on the whole operation; `TradeGuard` around it; and the daily trade count and
 * gas budget. Experimental, as Namera's policies are.
 *
 * @stability experimental
 * @category constructors
 * @since 0.0.0
 */
export const sessionPolicies = (config: PolicyConfig): ReadonlyArray<Policy.Policy> => {
  const action = (to: Address, selector: Hex) =>
    Policy.custom({ kind: "call", address: aerodromeTradePolicy, initData: ACTION_INIT_DATA, to, selector })

  return [
    action(swapRouter, EXACT_INPUT_SINGLE),
    ...[usdc, ...config.trade.stocks.map((symbol) => stockOf(symbol).token)].map((token) => action(token, APPROVE)),
    Policy.custom({ kind: "limit", address: aerodromeTradePolicy, initData: tradeOperationInitData(config) }),
    Policy.execution({ address: tradeGuard, initData: tradeGuardInitData(config) }),
    Policy.rateLimit({ count: config.tradesPerDay, period: "day" }),
    Policy.gas({ maxCost: DAILY_GAS_WEI, period: "day" })
  ]
}
