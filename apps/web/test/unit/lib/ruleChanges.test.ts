import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import { ruleChanges } from "../../../src/lib/ruleChanges.ts"
import { PICKER } from "../../fixtures/Agents.ts"

const nameOf = (symbol: string) => symbol === "NVDA" ? "Nvidia" : "Apple"

describe("ruleChanges", () => {
  it("a smaller preset over one stock fewer: each changed setting, before and after", () => {
    const after = draftSpec({ template: "stockPicker", preset: "conservative", stocks: ["NVDA"], targets: [] })

    assert.deepStrictEqual(ruleChanges(PICKER, after, compareSpecs(PICKER, after), nameOf), [
      {
        title: "Stocks and direction",
        change: "tighter",
        fields: [
          { label: "Stocks", before: "Nvidia and Apple", after: "Nvidia" },
          { label: "Daily budget", before: "$250", after: "$100" }
        ]
      },
      { title: "Trade size", change: "tighter", fields: [{ label: "Ask you above", before: "$100", after: "$50" }] },
      {
        title: "Max in one stock",
        change: "tighter",
        fields: [{ label: "Max in one stock", before: "30%", after: "20%" }]
      },
      { title: "Cash reserve", change: "tighter", fields: [{ label: "Cash reserve", before: "10%", after: "20%" }] }
    ])
  })

  it("the same rules: nothing to show", () => {
    assert.deepStrictEqual(ruleChanges(PICKER, PICKER, compareSpecs(PICKER, PICKER), nameOf), [])
  })
})
