import { AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import type { Leg } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { doesText, lastTradeText, todayOf } from "../../../../../src/features/agents/model/summary.ts"

const NAMES: Readonly<Record<string, string>> = { NVDA: "Nvidia", AAPL: "Apple" }
const nameOf = (symbol: StockSymbol) => NAMES[symbol] ?? symbol

describe("doesText", () => {
  it.each(
    [
      { name: "a Stock picker buys and sells", template: "stockPicker", expected: "Buys and sells Nvidia and Apple" },
      { name: "a Weekly buyer buys", template: "weeklyBuyer", expected: "Buys Nvidia and Apple" },
      { name: "a Stop-loss guard sells", template: "stopLossGuard", expected: "Sells Nvidia and Apple" },
      {
        name: "a Rebalancer keeps cash in the mix",
        template: "rebalancer",
        expected: "Rebalances Nvidia, Apple and cash"
      }
    ] as const
  )("$name", ({ template, expected }) => {
    const spec = draftSpec({ template, preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

    assert.strictEqual(doesText(spec, nameOf), expected)
  })
})

describe("lastTradeText", () => {
  const now = new Date("2026-11-26T15:00:00Z")

  it.each<{ name: string; leg: Leg; at: string; expected: string }>([
    {
      name: "a buy today, at its time",
      leg: { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(50_000_000n) } },
      at: "2026-11-26T09:41:00Z",
      expected: "Bought $50.00 of Apple at 09:41"
    },
    {
      name: "a sale of shares on an earlier day, on its date",
      leg: { symbol: "NVDA", side: "sell", amount: { shares: Shares.make(150_000_000n) } },
      at: "2026-11-23T16:00:00Z",
      expected: "Sold 1.5 shares of Nvidia on Mon 23 Nov"
    }
  ])("$name", ({ leg, at, expected }) => {
    assert.strictEqual(lastTradeText({ leg, updatedAt: DateTime.makeUnsafe(at) }, nameOf, now, "UTC"), expected)
  })
})

describe("todayOf", () => {
  it("dollars spent of its budget, and trades made of the most a day", () => {
    const usage = new AgentUsage({
      policies: [
        new PolicyUsage({ policy: "trade", unit: "usd", used: 75_000_000n, limit: 250_000_000n }),
        new PolicyUsage({ policy: "tradesPerDay", unit: "count", used: 2n, limit: 3n })
      ]
    })

    assert.deepStrictEqual(todayOf(usage), { spentToday: 75, dailyBudget: 250, tradesToday: 2, tradesPerDay: 3 })
  })

  it("nothing counted yet reads as nothing used and no budget", () => {
    assert.deepStrictEqual(todayOf(new AgentUsage({ policies: [] })), {
      spentToday: 0,
      dailyBudget: 0,
      tradesToday: 0,
      tradesPerDay: 0
    })
  })
})
