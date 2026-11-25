import { scratchSpec, templateSpec } from "@bluechip/domain/policies/SpecEdits"
import { assert, describe, it } from "@effect/vitest"
import {
  type Origin,
  originKey,
  originLabel,
  originPresets,
  originSpec,
  originTemplate,
  SCRATCH
} from "../../../../../src/features/agents/model/origin.ts"
import { PICKER, SAVED, TEMPLATE_ID } from "../../../../fixtures/Agents.ts"

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

  it("a saved template: its own policies, whatever was picked", () => {
    assert.deepStrictEqual(originSpec(FROM_SAVED, ["MSFT"]), PICKER)
  })

  it("scratch: the empty spec", () => {
    assert.deepStrictEqual(originSpec(FROM_SCRATCH, ["NVDA"]), scratchSpec())
  })
})
