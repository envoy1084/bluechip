import type { Action } from "@bluechip/domain/automations/Automation"
import { planLegs } from "@bluechip/domain/automations/Planner"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it } from "@effect/vitest"
import { BUY_50_AAPL, price, SELL_HALF_NVDA, STOP_LOSS_GUARD, WEEKLY_BUYER } from "../../fixtures/Automations.ts"
import { changed, REBALANCER } from "../../fixtures/Specs.ts"

// $1,000 of cash and 2.5 shares of NVIDIA at $100.
const context = (spec: AgentSpec | null) => ({
  portfolio: {
    value: Usdc.make(1_250_000_000n),
    holdings: [{ symbol: "NVDA" as const, shares: Shares.make(250_000_000n), value: Usdc.make(250_000_000n) }]
  } as never,
  prices: new Map([["NVDA" as const, price(100)], ["AAPL" as const, price(200)]]),
  spec
})

const buy = (dollars: number, ...split: ReadonlyArray<readonly [string, number]>): Action => ({
  type: "buy",
  config: {
    amount: Usdc.make(BigInt(dollars) * 1_000_000n),
    split: split.map(([symbol, weight]) => ({ symbol: symbol as "AAPL", weight }))
  }
})

const usdc = (dollars: number) => ({ usdc: Usdc.make(BigInt(dollars * 1_000_000)) })
const shares = (units: bigint) => ({ shares: Shares.make(units) })

describe("planLegs", () => {
  it.each<{ name: string; action: Action; spec: AgentSpec | null; asking?: boolean; expected: unknown }>([
    {
      name: "$50 of Apple",
      action: BUY_50_AAPL,
      spec: WEEKLY_BUYER,
      expected: [{ symbol: "AAPL", side: "buy", amount: usdc(50) }]
    },
    {
      name: "$100 split 60/40",
      action: buy(100, ["AAPL", 6000], ["NVDA", 4000]),
      spec: null,
      expected: [{ symbol: "AAPL", side: "buy", amount: usdc(60) }, { symbol: "NVDA", side: "buy", amount: usdc(40) }]
    },
    {
      name: "$250 through a $100 largest trade, 12 trades a day: three even trades",
      action: buy(250, ["AAPL", 10_000]),
      spec: changed(WEEKLY_BUYER, { id: "tradesPerDay", config: { count: 12 } }),
      expected: [
        { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(83_333_333n) } },
        { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(83_333_333n) } },
        { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(83_333_334n) } }
      ]
    },
    {
      name: "$250 through a $100 largest trade, 1 trade a day: the first trade only",
      action: buy(250, ["AAPL", 10_000]),
      spec: WEEKLY_BUYER,
      expected: [{ symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(83_333_333n) } }]
    },
    {
      name: "$250 of your own: not split",
      action: buy(250, ["AAPL", 10_000]),
      spec: null,
      expected: [{ symbol: "AAPL", side: "buy", amount: usdc(250) }]
    },
    {
      name: "half of $250 of NVIDIA through a $100 largest trade: two sales",
      action: SELL_HALF_NVDA,
      spec: STOP_LOSS_GUARD,
      expected: [
        { symbol: "NVDA", side: "sell", amount: shares(62_500_000n) },
        { symbol: "NVDA", side: "sell", amount: shares(62_500_000n) }
      ]
    },
    {
      name: "half of NVIDIA asking first: one sale",
      action: SELL_HALF_NVDA,
      spec: STOP_LOSS_GUARD,
      asking: true,
      expected: [{ symbol: "NVDA", side: "sell", amount: shares(125_000_000n) }]
    },
    {
      name: "$500 of NVIDIA, holding $250: all of it",
      action: { type: "sell", config: { symbol: "NVDA", amount: Usdc.make(500_000_000n) } },
      spec: null,
      expected: [{ symbol: "NVDA", side: "sell", amount: shares(250_000_000n) }]
    },
    {
      name: "half of Apple, holding none",
      action: { type: "sellShare", config: { symbol: "AAPL", bps: 5000 } },
      spec: null,
      expected: []
    },
    { name: "a message", action: { type: "notify", config: { message: "Look" } }, spec: null, expected: [] },
    {
      name: "a rebalance to 30/30/40 from $1,000 cash and $250 of NVIDIA: buy Apple and NVIDIA",
      action: { type: "rebalance", config: {} },
      spec: changed(REBALANCER, { id: "tradeSize", config: { maxPerTrade: Usdc.make(1_000_000_000n) } }),
      expected: [
        { symbol: "NVDA", side: "buy", amount: usdc(125) },
        { symbol: "AAPL", side: "buy", amount: usdc(375) }
      ]
    }
  ])("$name", ({ action, asking, expected, spec }) => {
    assert.deepStrictEqual(planLegs(action, context(spec), asking ?? false), expected)
  })
})
