import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import { templateAutomations } from "../../../../../src/features/agents/model/templateAutomations.ts"

describe("templateAutomations", () => {
  it("a Weekly buyer comes with a weekly buy per stock, kept, as it came, for an agent not saved yet", () => {
    const spec = draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

    const automations = templateAutomations({ kind: "builtIn", template: "weeklyBuyer" }, spec)

    assert.deepStrictEqual(
      automations.map(({ draft, kept, edited }) => [draft.name, draft.agentId, kept, edited]),
      [["Weekly buy of NVDA", null, true, false], ["Weekly buy of AAPL", null, true, false]]
    )
  })

  it("each has its own request id", () => {
    const spec = draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

    const [first, second] = templateAutomations({ kind: "builtIn", template: "weeklyBuyer" }, spec)

    assert.match(first!.id, /^[0-9a-f-]{36}$/)
    assert.notStrictEqual(first!.id, second!.id)
  })

  it.each(
    [
      { name: "a Stock picker comes with none", origin: { kind: "builtIn", template: "stockPicker" } },
      { name: "an agent from scratch comes with none", origin: { kind: "scratch" } }
    ] as const
  )("$name", ({ origin }) => {
    const spec = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA"], targets: [] })

    assert.deepStrictEqual(templateAutomations(origin, spec), [])
  })
})
