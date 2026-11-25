import { assert, describe, it } from "@effect/vitest"
import { templateLabel, uiTemplate } from "../../../../../src/features/agents/model/templateLabel.ts"
import { SAVED, TEMPLATE_ID } from "../../../../fixtures/Agents.ts"

describe("uiTemplate", () => {
  it.each<{ template: "rebalancer" | "stockPicker" | "weeklyBuyer" | "stopLossGuard"; expected: string }>([
    { template: "rebalancer", expected: "rebalancer" },
    { template: "stockPicker", expected: "stock-picker" },
    { template: "weeklyBuyer", expected: "weekly-buyer" },
    { template: "stopLossGuard", expected: "stop-loss-guard" }
  ])("$template: $expected", ({ expected, template }) => {
    assert.strictEqual(uiTemplate(template), expected)
  })
})

describe("templateLabel", () => {
  it("built from scratch: Custom", () => {
    assert.strictEqual(templateLabel(null, [SAVED]), "Custom")
  })

  it("a built-in template: its title", () => {
    assert.strictEqual(templateLabel("weeklyBuyer", []), "Weekly buyer")
  })

  it("a saved template: its name", () => {
    assert.strictEqual(templateLabel(TEMPLATE_ID, [SAVED]), "My picker")
  })

  it("a saved template since deleted: Custom", () => {
    assert.strictEqual(templateLabel(TEMPLATE_ID, []), "Custom")
  })
})
