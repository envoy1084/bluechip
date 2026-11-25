// The shared agent-rule vectors (packages/domain/test/agents/vectors.ts) as the contracts take them: each case's
// TradeGuard input, ABI-encoded, with the error the guard must revert with, and each case's batch for
// AerodromeTradePolicy's shape check with whether it passes. Foundry reads `contracts/test/vectors.json`.
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { swapRouter } from "@bluechip/chain/market/Aerodrome"
import { holdingsAfter, type Rule } from "@bluechip/domain/agents/Evaluate"
import { policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import * as DateTime from "effect/DateTime"
import { type Address, encodeAbiParameters, encodeFunctionData, type Hex, parseAbi, toFunctionSelector } from "viem"
import { VECTORS } from "../../packages/domain/test/agents/vectors.ts"

/** The account every vector's operation is made by. */
export const VECTOR_ACCOUNT: Address = "0x0000000000000000000000000000000000000acc"

const MODES = { buy: 0, sell: 1, both: 2, rebalance: 3 } as const

// The guard's errors in the order it checks them. A vector's expected error is the first of its broken rules here;
// rules only validation or the swap itself enforces (the daily budget, an empty trade, too little to spend) have
// none.
const GUARD_ERRORS: ReadonlyArray<readonly [Rule, string]> = [
  ["notAllowedStock", "NotAllowedStock(address)"],
  ["wrongDirection", "WrongDirection(address)"],
  ["pricesStale", "PricesStale(address)"],
  ["pausedTradingOff", "PausedTradingOff(address)"],
  ["tooSmall", "TooSmall(address)"],
  ["overTradeSize", "OverTradeSize(address)"],
  ["unfairPrice", "UnfairPrice()"],
  ["overStockCap", "OverStockCap(address)"],
  ["underCashReserve", "UnderCashReserve()"],
  ["notNeeded", "NotNeeded()"],
  ["wrongWay", "WrongWay(address)"],
  ["overshoots", "Overshoots(address)"],
  ["noProgress", "NoProgress()"],
  ["losesValue", "LosesValue()"],
  ["overSlippageBudget", "OverSlippageBudget()"]
]

// Where the guard measures what the offchain rules count per swap, by design (plan 012): sizes are per stock over
// the whole operation, so two buys of one stock are one trade.
const GUARD_OVERRIDES: Readonly<Record<string, Rule | "pass">> = {
  "an operation over the daily budget": "overTradeSize"
}

// A Rebalancer's moved assets are checked one by one (direction, then overshoot), so between those two rules the
// order the domain reports them in, which follows the assets, decides.
const rank = (rule: Rule) => {
  const index = GUARD_ERRORS.findIndex(([candidate]) => candidate === rule)
  return rule === "overshoots" ? GUARD_ERRORS.findIndex(([candidate]) => candidate === "wrongWay") : index
}

const firstGuardError = (rules: ReadonlyArray<Rule>) => {
  const guarded = rules.filter((rule) => rank(rule) >= 0)
  const first = guarded.reduce<Rule | undefined>(
    (best, rule) => (best === undefined || rank(rule) < rank(best) ? rule : best),
    undefined
  )
  return GUARD_ERRORS.find(([rule]) => rule === first)
}

const STOCK = [
  { type: "address", name: "token" },
  { type: "bool", name: "allowed" },
  { type: "uint16", name: "targetBps" },
  { type: "uint256", name: "balanceBefore" },
  { type: "uint256", name: "balanceAfter" },
  { type: "int256", name: "price" },
  { type: "uint256", name: "updatedAt" }
] as const

const SETTINGS = [
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

const GUARD_INPUT = [{
  type: "tuple",
  components: [
    { type: "tuple", name: "settings", components: SETTINGS },
    { type: "uint256", name: "cashBefore" },
    { type: "uint256", name: "cashAfter" },
    { type: "tuple[]", name: "stocks", components: STOCK },
    { type: "uint256", name: "slippageUsed" },
    { type: "uint256", name: "slippageUpdatedAt" },
    { type: "uint256", name: "time" }
  ]
}] as const

const SHAPE_SETTINGS = [{
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
}] as const

const CALLS = [{
  type: "tuple[]",
  components: [{ type: "address", name: "target" }, { type: "uint256", name: "value" }, { type: "bytes", name: "data" }]
}] as const

const swapAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256)"
])

/** One vector for TradeGuard: its encoded input, and the error selector it must revert with (`0x` to pass). */
export interface GuardVector {
  readonly name: string
  readonly input: Hex
  readonly error: Hex
}

/** One vector for AerodromeTradePolicy's shape check: its settings and calls, and what the check must answer. */
export interface ShapeVector {
  readonly name: string
  readonly settings: Hex
  readonly calls: Hex
  readonly ok: boolean
  readonly buys: string
}

const tokenOf = (symbol: string): Address => stocks.find((stock) => stock.symbol === symbol)!.token

const guardVectors = (): ReadonlyArray<GuardVector> =>
  VECTORS.flatMap((vector): Array<GuardVector> => {
    const { holdings, legs, limits, prices, usage } = vector.proposal
    const after = holdingsAfter(holdings, legs)
    if (legs.length === 0 || legs.some((leg) => leg.amountIn <= BigInt(0)) || after === undefined) return []

    const { guard } = policyConfig(limits)
    const time = BigInt(Number(DateTime.toEpochMillis(vector.proposal.now)) / 1000)
    const target = (asset: string) => guard.targets.find((t) => t.asset === asset)?.weight ?? 0

    const input = {
      settings: {
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
        cashTargetBps: target("USDC")
      },
      cashBefore: holdings.usdc,
      cashAfter: after.usdc,
      stocks: guard.valued.map((symbol) => {
        const feed = prices[symbol]
        return {
          token: tokenOf(symbol),
          allowed: guard.allowed.includes(symbol),
          targetBps: target(symbol),
          balanceBefore: holdings.shares[symbol] ?? BigInt(0),
          balanceAfter: after.shares[symbol] ?? BigInt(0),
          price: feed?.price ?? BigInt(0),
          updatedAt: feed === undefined ? BigInt(0) : time - BigInt(feed.ageSeconds)
        }
      }),
      slippageUsed: usage.slippage.used,
      slippageUpdatedAt: BigInt(usage.slippage.updatedAt),
      time
    }

    const broken = new Set([
      ...(vector.expected.rules ?? []).map((rule) => rule.split(" ")[0] as Rule),
      ...(vector.expected.decision === "NeedsApproval" ? ["overTradeSize" as const] : [])
    ])
    const override = GUARD_OVERRIDES[vector.name]
    const first = override === undefined ? firstGuardError([...broken]) : undefined
    const error = override === "pass" ?
      undefined :
      override !== undefined ?
      GUARD_ERRORS.find(([rule]) => rule === override) :
      first

    return [{
      name: vector.name,
      input: encodeAbiParameters(GUARD_INPUT, [input]),
      error: error === undefined ? "0x" : toFunctionSelector(`error ${error[1]}`)
    }]
  })

const shapeVectors = (): ReadonlyArray<ShapeVector> =>
  VECTORS.map((vector) => {
    const { legs, limits } = vector.proposal
    const { trade } = policyConfig(limits)

    const calls = legs.flatMap((leg) => {
      const buying = leg.side === "buy"
      const tokenIn = buying ? usdc : tokenOf(leg.symbol)
      const tokenOut = buying ? tokenOf(leg.symbol) : usdc
      return [
        {
          target: tokenIn,
          value: BigInt(0),
          data: encodeFunctionData({ abi: swapAbi, functionName: "approve", args: [swapRouter, leg.amountIn] })
        },
        {
          target: swapRouter,
          value: BigInt(0),
          data: encodeFunctionData({
            abi: swapAbi,
            functionName: "exactInputSingle",
            args: [{
              tokenIn,
              tokenOut,
              tickSpacing: 10,
              recipient: VECTOR_ACCOUNT,
              deadline: BigInt(2) ** BigInt(40),
              amountIn: leg.amountIn,
              amountOutMinimum: leg.amountOut,
              sqrtPriceLimitX96: BigInt(0)
            }]
          })
        }
      ]
    })

    const rules = new Set((vector.expected.rules ?? []).map((rule) => rule.split(" ")[0]))
    const buyLegs = legs.filter((leg) => leg.side === "buy")
    const ok = legs.length > 0 &&
      !["notAllowedStock", "wrongDirection", "nothingToTrade"].some((rule) => rules.has(rule)) &&
      buyLegs.every((leg) => leg.amountIn <= trade.maxUsdcIn)

    return {
      name: vector.name,
      settings: encodeAbiParameters(SHAPE_SETTINGS, [{
        mode: MODES[trade.mode],
        maxUsdcIn: trade.maxUsdcIn,
        dailyBudget: trade.dailyBudget,
        markets: trade.stocks.map((symbol) => ({ token: tokenOf(symbol), tickSpacing: 10 }))
      }]),
      calls: encodeAbiParameters(CALLS, [calls]),
      ok,
      buys: ok ? String(buyLegs.reduce((sum, leg) => sum + leg.amountIn, BigInt(0))) : "0"
    }
  })

/** Every vector, for `contracts/test/vectors.json`. */
export const contractVectors = () => ({
  account: VECTOR_ACCOUNT,
  usdc,
  router: swapRouter,
  guard: guardVectors(),
  shape: shapeVectors()
})
