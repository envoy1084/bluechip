import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Field } from "@bluechip/domain/policies/Policy"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { dayLabel, fieldText, toDollars } from "../../../../../src/features/agents/model/fieldText.ts"

const NAMES: Readonly<Record<string, string>> = { NVDA: "Nvidia", AAPL: "Apple", MSFT: "Microsoft", TSLA: "Tesla" }
const nameOf = (symbol: StockSymbol) => NAMES[symbol] ?? symbol

describe("toDollars", () => {
  it.each<{ name: string; amount: bigint | number; expected: number }>([
    { name: "a bigint", amount: 250_500_000n, expected: 250.5 },
    { name: "a number", amount: 1_000_000, expected: 1 }
  ])("$name", ({ amount, expected }) => {
    assert.strictEqual(toDollars(amount), expected)
  })
})

describe("fieldText", () => {
  it.each<{ name: string; field: Field; value: unknown; expected: string }>([
    {
      name: "dollars",
      field: new Field({ label: "Daily budget", unit: "usd" }),
      value: 250_000_000n,
      expected: "$250"
    },
    { name: "a percent", field: new Field({ label: "Max", unit: "bps" }), value: 3000, expected: "30%" },
    { name: "a count", field: new Field({ label: "Trades", unit: "count" }), value: 12, expected: "12" },
    { name: "a toggle on", field: new Field({ label: "Paused", unit: "toggle" }), value: true, expected: "On" },
    { name: "a toggle off", field: new Field({ label: "Paused", unit: "toggle" }), value: false, expected: "Off" },
    {
      name: "stocks by name",
      field: new Field({ label: "Stocks", unit: "stocks" }),
      value: ["NVDA", "AAPL"],
      expected: "Nvidia and Apple"
    },
    {
      name: "more than three stocks",
      field: new Field({ label: "Stocks", unit: "stocks" }),
      value: ["NVDA", "AAPL", "MSFT", "TSLA"],
      expected: "Nvidia, Apple, Microsoft and 1 more"
    },
    { name: "no stocks", field: new Field({ label: "Stocks", unit: "stocks" }), value: [], expected: "no stocks" },
    {
      name: "a direction",
      field: new Field({ label: "Direction", unit: "direction" }),
      value: "rebalance",
      expected: "Rebalance only"
    },
    {
      name: "a mix, cash by its word",
      field: new Field({ label: "Mix", unit: "mix" }),
      value: [{ asset: "NVDA", weight: 4000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 3000 }],
      expected: "Nvidia 40%, Apple 30% and cash 30%"
    },
    {
      name: "gas in gwei",
      field: new Field({ label: "Gas", unit: "wei" }),
      value: 2_500_000_000n,
      expected: "2.5 gwei"
    }
  ])("$name", ({ expected, field, value }) => {
    assert.strictEqual(fieldText(field, value, nameOf), expected)
  })
})

describe("dayLabel", () => {
  it.each<{ name: string; date: Date | DateTime.Utc; expected: string }>([
    { name: "a Date", date: new Date("2026-02-21T12:00:00Z"), expected: "21 Feb" },
    { name: "a DateTime", date: DateTime.makeUnsafe("2026-12-01T12:00:00Z"), expected: "1 Dec" }
  ])("$name", ({ date, expected }) => {
    assert.strictEqual(dayLabel(date), expected)
  })
})
