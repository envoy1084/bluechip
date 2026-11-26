import { addPolicy, scratchSpec } from "@bluechip/domain/policies/SpecEdits"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import { policySections, policySummary } from "../../../../../src/features/agents/model/policySections.ts"
import { PICKER } from "../../../../fixtures/Agents.ts"

const nameOf = (symbol: string) => ({ NVDA: "Nvidia", AAPL: "Apple" })[symbol] ?? symbol

describe("policySections", () => {
  it("a stock picker: its limits, on or off, in the catalog's order, and its fine-tuning", () => {
    assert.deepStrictEqual(policySections(PICKER), {
      limits: ["tradeSize", "stockCap", "cashReserve", "rebalance", "stopLossFloor"],
      fineTuning: ["fairPrice", "slippageBudget", "tradesPerDay"]
    })
  })

  it("from scratch: the same rows in the same order, most of them off", () => {
    assert.deepStrictEqual(policySections(scratchSpec()), {
      limits: ["tradeSize", "stockCap", "cashReserve", "rebalance", "stopLossFloor"],
      fineTuning: ["fairPrice", "slippageBudget", "tradesPerDay"]
    })
  })

  it("a rule switched on stays where it was", () => {
    assert.deepStrictEqual(
      policySections(addPolicy(scratchSpec(), "slippageBudget")).fineTuning,
      ["fairPrice", "slippageBudget", "tradesPerDay"]
    )
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
      "Trade Nvidia and Apple, only to move you back to your target mix. Spend up to $2,000 a day."
    )
  })
})
