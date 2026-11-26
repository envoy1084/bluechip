import { addPolicy, scratchSpec } from "@bluechip/domain/policies/SpecEdits"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import { policySections, policySummary } from "../../../../../src/features/agents/model/policySections.ts"
import { PICKER } from "../../../../fixtures/Agents.ts"

const nameOf = (symbol: string) => ({ NVDA: "Nvidia", AAPL: "Apple" })[symbol] ?? symbol

describe("policySections", () => {
  it("a stock picker: its limits, the rules to add, and its fine-tuning", () => {
    assert.deepStrictEqual(policySections(PICKER), {
      limits: ["tradeSize", "stockCap", "cashReserve"],
      more: ["rebalance", "stopLossFloor"],
      fineTuning: ["fairPrice", "slippageBudget", "tradesPerDay"],
      fineTuningToAdd: []
    })
  })

  it("from scratch: only the limits every agent has", () => {
    assert.deepStrictEqual(policySections(scratchSpec()), {
      limits: ["tradeSize"],
      more: ["stockCap", "cashReserve", "rebalance", "stopLossFloor"],
      fineTuning: ["fairPrice", "tradesPerDay"],
      fineTuningToAdd: ["slippageBudget"]
    })
  })

  it("an added fine-tuning rule moves from the ones to add to the ones it carries", () => {
    const sections = policySections(addPolicy(scratchSpec(), "slippageBudget"))
    assert.deepStrictEqual([sections.fineTuning, sections.fineTuningToAdd], [
      ["fairPrice", "slippageBudget", "tradesPerDay"],
      []
    ])
  })
})

describe("policySummary", () => {
  it("a policy it carries, in its own words", () => {
    assert.strictEqual(
      policySummary(PICKER, "tradeSize", nameOf),
      "Trade up to $100 at a time, and ask you before anything bigger."
    )
  })

  it("a policy it doesn't carry: the catalog's summary", () => {
    assert.strictEqual(
      policySummary(scratchSpec(), "stockCap", nameOf),
      "The largest share of your money its trades may put in one stock."
    )
  })

  it("a rebalancer's stocks and direction", () => {
    const rebalancer = draftSpec({ template: "rebalancer", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })
    assert.strictEqual(
      policySummary(rebalancer, "trade", nameOf),
      "Trade Nvidia and Apple, only to move you back to your target mix. Spend up to $250 a day."
    )
  })
})
