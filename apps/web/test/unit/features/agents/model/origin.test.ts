import { scratchSpec, templateSpec } from "@bluechip/domain/policies/SpecEdits"
import { assert, describe, it } from "@effect/vitest"
import {
  type Origin,
  originKey,
  originLabel,
  originOf,
  originPresets,
  originSpec,
  originTemplate,
  SCRATCH
} from "../../../../../src/features/agents/model/origin.ts"
import { agent, PICKER, SAVED, TEMPLATE_ID } from "../../../../fixtures/Agents.ts"

const BUILT_IN: Origin = { kind: "builtIn", template: "weeklyBuyer" }
const FROM_SAVED: Origin = { kind: "saved", template: SAVED }
const FROM_SCRATCH: Origin = { kind: "scratch" }

describe("originKey", () => {
  it.each<{ name: string; origin: Origin; expected: string }>([
    { name: "a built-in template: its id", origin: BUILT_IN, expected: "weeklyBuyer" },
    { name: "a saved template: its id", origin: FROM_SAVED, expected: TEMPLATE_ID },
    { name: "scratch", origin: FROM_SCRATCH, expected: SCRATCH }
  ])("$name", ({ expected, origin }) => {
    assert.strictEqual(originKey(origin), expected)
  })
})

describe("originTemplate", () => {
  it.each<{ name: string; origin: Origin; expected: string | null }>([
    { name: "a built-in template: its id", origin: BUILT_IN, expected: "weeklyBuyer" },
    { name: "a saved template: its id", origin: FROM_SAVED, expected: TEMPLATE_ID },
    { name: "scratch: none", origin: FROM_SCRATCH, expected: null }
  ])("$name", ({ expected, origin }) => {
    assert.strictEqual(originTemplate(origin), expected)
  })
})

describe("originLabel", () => {
  it.each<{ name: string; origin: Origin; expected: string }>([
    { name: "a built-in template: its title", origin: BUILT_IN, expected: "Weekly buyer" },
    { name: "a saved template: its name", origin: FROM_SAVED, expected: "My picker" },
    { name: "scratch", origin: FROM_SCRATCH, expected: "Custom agent" }
  ])("$name", ({ expected, origin }) => {
    assert.strictEqual(originLabel(origin), expected)
  })
})

describe("originPresets", () => {
  it.each<{ name: string; origin: Origin; expected: string | null }>([
    { name: "a built-in template has presets", origin: BUILT_IN, expected: "weeklyBuyer" },
    { name: "a saved template has none", origin: FROM_SAVED, expected: null },
    { name: "scratch has none", origin: FROM_SCRATCH, expected: null }
  ])("$name", ({ expected, origin }) => {
    assert.strictEqual(originPresets(origin), expected)
  })
})

describe("originSpec", () => {
  it("a built-in template: its balanced preset over the stocks picked", () => {
    assert.deepStrictEqual(originSpec(BUILT_IN, ["NVDA"]), templateSpec("weeklyBuyer", "balanced", ["NVDA"]))
  })

  it("a Rebalancer with nothing picked: no stocks picked for you", () => {
    assert.deepStrictEqual(
      originSpec({ kind: "builtIn", template: "rebalancer" }, []),
      templateSpec("rebalancer", "balanced", [])
    )
  })

  it("a Stop-loss guard: its floor switched on, with no floors set yet", () => {
    const spec = originSpec({ kind: "builtIn", template: "stopLossGuard" }, ["NVDA"])

    assert.deepStrictEqual(spec.policies.find((entry) => entry.id === "stopLossFloor"), {
      id: "stopLossFloor",
      config: { floors: [] }
    })
  })

  it("a saved template: its own policies, whatever was picked", () => {
    assert.deepStrictEqual(originSpec(FROM_SAVED, ["MSFT"]), PICKER)
  })

  it("scratch: the empty spec", () => {
    assert.deepStrictEqual(originSpec(FROM_SCRATCH, ["NVDA"]), scratchSpec())
  })
})

describe("originOf", () => {
  it("a draft from a built-in template", () => {
    assert.deepStrictEqual(originOf(agent("draft", { template: "weeklyBuyer" }), [SAVED]), {
      kind: "builtIn",
      template: "weeklyBuyer"
    })
  })

  it("a draft from a saved template: that template", () => {
    assert.deepStrictEqual(originOf(agent("draft", { template: TEMPLATE_ID }), [SAVED]), {
      kind: "saved",
      template: SAVED
    })
  })

  it("a draft from a saved template since deleted: scratch", () => {
    assert.deepStrictEqual(originOf(agent("draft", { template: TEMPLATE_ID }), []), { kind: "scratch" })
  })

  it("a draft from scratch", () => {
    assert.deepStrictEqual(originOf(agent("draft", { template: null }), [SAVED]), { kind: "scratch" })
  })
})
