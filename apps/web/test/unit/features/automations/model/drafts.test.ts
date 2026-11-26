import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import type { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import {
  catalogEntry,
  changeField,
  choicesOf,
  evenSplit,
  freshEntry,
  newDraft,
  offered,
  stocksFor,
  suggestedName,
  toDraft,
  whyUnavailable
} from "../../../../../src/features/automations/model/drafts.ts"

describe("evenSplit", () => {
  it.each<{
    name: string
    symbols: ReadonlyArray<StockSymbol>
    expected: ReadonlyArray<{ symbol: StockSymbol; weight: number }>
  }>(
    [
      { name: "one stock takes it all", symbols: ["NVDA"], expected: [{ symbol: "NVDA", weight: 10_000 }] },
      {
        name: "two stocks halve it",
        symbols: ["NVDA", "AAPL"],
        expected: [{ symbol: "NVDA", weight: 5000 }, { symbol: "AAPL", weight: 5000 }]
      },
      {
        name: "three stocks: the last takes what's left",
        symbols: ["NVDA", "AAPL", "MSFT"],
        expected: [{ symbol: "NVDA", weight: 3333 }, { symbol: "AAPL", weight: 3333 }, { symbol: "MSFT", weight: 3334 }]
      },
      { name: "no stocks", symbols: [], expected: [] }
    ]
  )("$name", ({ symbols, expected }) => {
    assert.deepStrictEqual(evenSplit(symbols), expected)
  })
})

describe("freshEntry", () => {
  it.each(
    [
      {
        name: "a price move about the stock given",
        kind: "trigger",
        type: "priceMove",
        expected: {
          type: "priceMove",
          config: { symbol: "AAPL", reference: "trailingHigh", bps: 1000, direction: "down" }
        }
      },
      {
        name: "a portfolio trigger on cash keeps no stock",
        kind: "trigger",
        type: "portfolio",
        expected: { type: "portfolio", config: { measure: "cash", symbol: null, direction: "below", bps: 1000 } }
      },
      {
        name: "news about the stock given",
        kind: "trigger",
        type: "news",
        expected: { type: "news", config: { symbols: ["AAPL"], topics: [] } }
      },
      {
        name: "a buy of the stock given, all of it",
        kind: "action",
        type: "buy",
        expected: { type: "buy", config: { amount: 50_000_000n, split: [{ symbol: "AAPL", weight: 10_000 }] } }
      },
      {
        name: "an ask proposes a trade in the stock given",
        kind: "action",
        type: "ask",
        expected: { type: "ask", config: { trade: { type: "sellShare", config: { symbol: "AAPL", bps: 5000 } } } }
      }
    ] as const
  )("$name", ({ kind, type, expected }) => {
    assert.deepStrictEqual(freshEntry(kind, type, "AAPL"), expected)
  })

  it("an ask for a Weekly buyer proposes a buy, the one trade it may make", () => {
    const spec = complete(draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["AAPL"], targets: [] }))

    const entry = freshEntry("action", "ask", "AAPL", { spec, trigger: "schedule", asking: false })

    assert.deepStrictEqual(entry, {
      type: "ask",
      config: { trade: { type: "buy", config: { amount: 50_000_000n, split: [{ symbol: "AAPL", weight: 10_000 }] } } }
    })
  })

  it("an ask for your own trades keeps the catalog's sale", () => {
    const entry = freshEntry("action", "ask", "AAPL", { spec: null, trigger: "schedule", asking: false })

    assert.deepStrictEqual(entry, {
      type: "ask",
      config: { trade: { type: "sellShare", config: { symbol: "AAPL", bps: 5000 } } }
    })
  })
})

describe("offered", () => {
  it("your own trades: every trigger but drift, every trade", () => {
    const context = { spec: null, trigger: "schedule", asking: false }

    assert.deepStrictEqual(offered("trigger", context).map((entry) => entry.type), [
      "schedule",
      "priceMove",
      "priceCross",
      "portfolio",
      "news"
    ])
    assert.deepStrictEqual(offered("action", context).map((entry) => entry.type), [
      "buy",
      "sell",
      "sellShare",
      "notify",
      "ask"
    ])
  })

  it("a Weekly buyer buys, tells you, or asks you about a buy", () => {
    const spec = complete(draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] }))

    const actions = offered("action", { spec, trigger: "schedule", asking: false })

    assert.deepStrictEqual(actions.map((entry) => entry.type), ["buy", "notify", "ask"])
  })

  it("a Rebalancer watches drift and only rebalances", () => {
    const spec = complete(
      draftSpec({ template: "rebalancer", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })
    )
    const context = { spec, trigger: "schedule", asking: false }

    assert.isTrue(offered("trigger", context).some((entry) => entry.type === "drift"))
    assert.deepStrictEqual(offered("action", context).map((entry) => entry.type), ["rebalance", "notify", "ask"])
  })

  it.each([
    { name: "a judgment only follows news", trigger: "news", expected: true },
    { name: "no judgment on a schedule", trigger: "schedule", expected: false }
  ])("$name", ({ trigger, expected }) => {
    const conditions = offered("condition", { spec: null, trigger, asking: true })

    assert.strictEqual(conditions.some((entry) => entry.type === "judgment"), expected)
  })
})

describe("whyUnavailable", () => {
  const weeklyBuyer = complete(
    draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] })
  )

  it.each(
    [
      { name: "a buy for your own trades can run", kind: "action", type: "buy", spec: null, expected: null },
      {
        name: "drift for your own trades needs an agent with a target mix",
        kind: "trigger",
        type: "drift",
        spec: null,
        expected: "Only an agent with a target mix can watch drift."
      },
      {
        name: "a sale for a Weekly buyer",
        kind: "action",
        type: "sell",
        spec: weeklyBuyer,
        expected: "This agent only buys."
      },
      { name: "asking a Weekly buyer about a buy", kind: "action", type: "ask", spec: weeklyBuyer, expected: null }
    ] as const
  )("$name", ({ kind, type, spec, expected }) => {
    const context = { spec, trigger: "schedule", asking: false }

    assert.strictEqual(whyUnavailable(catalogEntry(kind, type), context), expected)
  })
})

describe("changeField", () => {
  it.each([
    {
      name: "a holding brings the stock given",
      measure: "holding",
      expected: { measure: "holding", symbol: "AAPL", direction: "below", bps: 1000 }
    },
    {
      name: "cash drops the stock",
      measure: "cash",
      expected: { measure: "cash", symbol: null, direction: "below", bps: 1000 }
    }
  ])("$name", ({ measure, expected }) => {
    const entry = freshEntry("trigger", "portfolio", "AAPL")

    assert.deepStrictEqual(changeField(entry, "measure", measure, "AAPL").config, expected)
  })

  it("any other field changes alone", () => {
    const entry = freshEntry("trigger", "priceMove", "NVDA")

    assert.deepStrictEqual(changeField(entry, "bps", 2000, "AAPL").config, {
      symbol: "NVDA",
      reference: "trailingHigh",
      bps: 2000,
      direction: "down"
    })
  })
})

describe("choicesOf", () => {
  it("a choice field lists its schema's literals", () => {
    assert.deepStrictEqual(choicesOf(catalogEntry("trigger", "priceMove"), "reference"), [
      "previousClose",
      "open",
      "trailingHigh",
      "price"
    ])
  })

  it("a field that isn't a choice has none", () => {
    assert.deepStrictEqual(choicesOf(catalogEntry("trigger", "priceMove"), "bps"), [])
  })
})

describe("suggestedName", () => {
  it.each([
    { name: "what it does, capitalized", action: "buy $50 of Apple", expected: "Buy $50 of Apple" },
    { name: "nothing to say", action: "", expected: "My automation" },
    {
      name: "cut to 60 characters",
      action: "buy $50 split across Apple, Nvidia, Microsoft, Tesla, Meta and Amazon",
      expected: "Buy $50 split across Apple, Nvidia, Microsoft, Tesla, Meta…"
    }
  ])("$name", ({ action, expected }) => {
    assert.strictEqual(suggestedName(action), expected)
  })
})

describe("toDraft", () => {
  it.each([
    { name: "an empty name is named from what it does", typed: "  ", expected: "Buy $50 of Apple" },
    { name: "a typed name is kept, trimmed", typed: " Weekly Apple ", expected: "Weekly Apple" }
  ])("$name", ({ typed, expected }) => {
    const fields = { ...newDraft(null, "AAPL", DEFAULT_SETTINGS), name: typed }

    assert.strictEqual(toDraft(fields, "buy $50 of Apple").name, expected)
  })
})

describe("newDraft", () => {
  it("every Monday at 10:00, buying $50 of the stock given, for the agent given", () => {
    const agentId = "agent_01jd8v4t5m6n7a8q9r0s1t2v3w" as AgentId

    const draft: unknown = newDraft(agentId, "MSFT", DEFAULT_SETTINGS)

    assert.deepStrictEqual(draft, {
      name: "",
      agentId,
      trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
      conditions: [],
      action: { type: "buy", config: { amount: 50_000_000n, split: [{ symbol: "MSFT", weight: 10_000 }] } },
      settings: DEFAULT_SETTINGS
    })
  })

  it("on the trigger given, about the stock given", () => {
    const draft = newDraft(null, "MSFT", DEFAULT_SETTINGS, "priceMove")

    assert.deepStrictEqual(draft.trigger, {
      type: "priceMove",
      config: { symbol: "MSFT", reference: "trailingHigh", bps: 1000, direction: "down" }
    })
  })
})

describe("stocksFor", () => {
  it.each<{ name: string; spec: AgentSpec | null; expected: ReadonlyArray<StockSymbol> }>([
    { name: "your own trades: every stock", spec: null, expected: ["NVDA", "AAPL", "MSFT"] },
    {
      name: "an agent's: only its stocks",
      spec: draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["AAPL"], targets: [] }),
      expected: ["AAPL"]
    }
  ])("$name", ({ spec, expected }) => {
    assert.deepStrictEqual(stocksFor(spec, ["NVDA", "AAPL", "MSFT"]), expected)
  })
})
