import { news } from "@bluechip/domain/automations/triggers/News"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { assert, describe, it } from "@effect/vitest"

const NAMES: Readonly<Record<string, string>> = { NVDA: "NVIDIA", AAPL: "Apple" }

describe("news.describe", () => {
  it.each<{ name: string; symbols: ReadonlyArray<StockSymbol>; topics: ReadonlyArray<string>; expected: string }>([
    { name: "a stock", symbols: ["NVDA"], topics: [], expected: "when there is news about NVIDIA" },
    { name: "a topic", symbols: [], topics: ["recall"], expected: "when a story mentions \"recall\"" },
    {
      name: "two topics",
      symbols: [],
      topics: ["recall", "investigation"],
      expected: "when a story mentions \"recall\" or \"investigation\""
    },
    {
      name: "a stock and two topics",
      symbols: ["NVDA"],
      topics: ["recall", "investigation"],
      expected: "when there is news about NVIDIA, or a story mentioning \"recall\" or \"investigation\""
    }
  ])("$name", ({ expected, symbols, topics }) => {
    assert.strictEqual(news.describe({ symbols, topics }, { name: (symbol) => NAMES[symbol] ?? symbol }), expected)
  })
})
