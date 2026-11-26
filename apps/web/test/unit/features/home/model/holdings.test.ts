import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Bps, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { mixParts, movers } from "../../../../../src/features/home/model/holdings.ts"

const NAMES: Readonly<Record<string, string>> = { AAPL: "Apple", NVDA: "Nvidia", MSFT: "Microsoft", TSLA: "Tesla" }
const nameOf = (symbol: StockSymbol) => NAMES[symbol] ?? symbol

const holding = (symbol: string, dollars: number, change24h: number | null = null) => ({
  symbol: symbol as StockSymbol,
  value: Usdc.make(BigInt(dollars * 1_000_000)),
  change24h: change24h === null ? null : Bps.make(change24h)
})

describe("movers", () => {
  it("the biggest moves either way first, three at most, in percent and dollars", () => {
    assert.deepStrictEqual(
      movers([
        holding("AAPL", 1_000, 100),
        holding("NVDA", 1_020, 200),
        holding("MSFT", 950, -500),
        holding("TSLA", 500, 50)
      ]),
      [
        { symbol: "MSFT", value: 950, percent: -5, dollars: -50 },
        { symbol: "NVDA", value: 1_020, percent: 2, dollars: 20 },
        { symbol: "AAPL", value: 1_000, percent: 1, dollars: (1_000 * 100) / 10_100 }
      ]
    )
  })

  it("a holding with no price today is left out", () => {
    assert.deepStrictEqual(movers([holding("AAPL", 1_000)]), [])
  })
})

describe("mixParts", () => {
  const portfolio = (cash: number, holdings: ReadonlyArray<ReturnType<typeof holding>>) => ({
    cash: Usdc.make(BigInt(cash * 1_000_000)),
    value: Usdc.make(
      BigInt((cash + holdings.reduce((sum, each) => sum + Number(each.value) / 1_000_000, 0)) * 1_000_000)
    ),
    holdings
  })

  it("no money, no parts", () => {
    assert.deepStrictEqual(mixParts(portfolio(0, []), nameOf), [])
  })

  it("holdings biggest first, then cash", () => {
    assert.deepStrictEqual(mixParts(portfolio(500, [holding("AAPL", 200), holding("NVDA", 300)]), nameOf), [
      { id: "NVDA", label: "Nvidia", percent: 30 },
      { id: "AAPL", label: "Apple", percent: 20 },
      { id: "cash", label: "Cash", percent: 50 }
    ])
  })

  it("six holdings: the smallest two fold into Others", () => {
    const six = ["AAPL", "NVDA", "MSFT", "TSLA", "META", "GOOGL"].map((symbol, index) =>
      holding(symbol, 600 - index * 100)
    )

    assert.deepStrictEqual(mixParts(portfolio(0, six), nameOf).map((part) => [part.id, Math.round(part.percent)]), [
      ["AAPL", 29],
      ["NVDA", 24],
      ["MSFT", 19],
      ["TSLA", 14],
      ["others", 14]
    ])
  })
})
