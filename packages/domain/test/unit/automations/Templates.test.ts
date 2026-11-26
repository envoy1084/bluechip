import { checkAutomation, describeAutomation } from "@bluechip/domain/automations/Automation"
import { defaultAutomations } from "@bluechip/domain/automations/Templates"
import { AgentId } from "@bluechip/domain/Ids"
import { draftSpec, Preset, TemplateId } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"

const AGENT = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3w")

const specOf = (template: TemplateId, preset: Preset = "balanced") =>
  draftSpec({
    template,
    preset,
    stocks: ["NVDA", "AAPL"],
    targets: [{ asset: "NVDA", weight: 3000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 4000 }]
  })

describe("defaultAutomations", () => {
  it.each([
    {
      template: "weeklyBuyer" as const,
      expected: [
        "Every Monday at 10:00 New York time, buy $100 of NVDA.",
        "Every Tuesday at 10:00 New York time, buy $100 of AAPL."
      ]
    },
    {
      template: "stopLossGuard" as const,
      expected: [
        "When NVDA falls 10% from its high, if you still hold NVDA, sell half your NVDA.",
        "When AAPL falls 10% from its high, if you still hold AAPL, sell half your AAPL."
      ]
    },
    {
      template: "rebalancer" as const,
      expected: ["When your mix drifts past the agent's trigger, trade back to your target mix."]
    },
    { template: "stockPicker" as const, expected: [] }
  ])("$template, balanced", ({ expected, template }) => {
    const drafts = defaultAutomations(template, specOf(template), AGENT)

    assert.deepStrictEqual(drafts.map((draft) => describeAutomation(draft, (symbol) => symbol).sentence), expected)
  })

  it("a custom agent has none", () => {
    assert.deepStrictEqual(defaultAutomations(null, specOf("stockPicker"), AGENT), [])
  })

  it.each(
    TemplateId.literals.flatMap((template) => Preset.literals.map((preset) => ({ template, preset })))
  )("$template, $preset: each fits the agent's policies", ({ preset, template }) => {
    const spec = specOf(template, preset)

    const problems = defaultAutomations(template, spec, AGENT).flatMap((draft) => checkAutomation(draft, spec))

    assert.deepStrictEqual(problems, [])
  })
})
