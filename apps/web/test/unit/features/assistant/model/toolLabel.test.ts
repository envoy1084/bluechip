import { assert, describe, it } from "@effect/vitest"
import type { ToolRow } from "../../../../../src/features/assistant/model/thread.ts"
import { toolLabel } from "../../../../../src/features/assistant/model/toolLabel.ts"

describe("toolLabel", () => {
  it.each<{ name: string; row: ToolRow; expected: string }>([
    {
      name: "running",
      row: { id: "call-1", name: "getPortfolio", state: "running", summary: null, params: null, result: null },
      expected: "Reading your portfolio…"
    },
    {
      name: "done",
      row: { id: "call-1", name: "getPortfolio", state: "done", summary: null, params: null, result: null },
      expected: "Read your portfolio"
    },
    {
      name: "failed",
      row: { id: "call-1", name: "getPortfolio", state: "failed", summary: null, params: null, result: null },
      expected: "Didn't finish reading your portfolio"
    },
    {
      name: "web research",
      row: { id: "call-1", name: "AnthropicWebSearch", state: "done", summary: null, params: null, result: null },
      expected: "Searched the web"
    },
    {
      name: "an automation drafted",
      row: { id: "call-1", name: "createAutomation", state: "done", summary: null, params: null, result: null },
      expected: "Drafted the automation"
    },
    {
      name: "an automation paused",
      row: {
        id: "call-1",
        name: "pauseAutomation",
        state: "done",
        summary: null,
        params: { automationId: "automation-1", resume: false },
        result: null
      },
      expected: "Ready to pause the automation"
    },
    {
      name: "an automation resumed",
      row: {
        id: "call-1",
        name: "pauseAutomation",
        state: "running",
        summary: null,
        params: { automationId: "automation-1", resume: true },
        result: null
      },
      expected: "Preparing to resume the automation…"
    },
    {
      name: "an unknown tool running",
      row: { id: "call-1", name: "later", state: "running", summary: null, params: null, result: null },
      expected: "Working on it…"
    },
    {
      name: "an unknown tool done",
      row: { id: "call-1", name: "later", state: "done", summary: null, params: null, result: null },
      expected: "Done"
    },
    {
      name: "an unknown tool failed",
      row: { id: "call-1", name: "later", state: "failed", summary: null, params: null, result: null },
      expected: "Didn't finish working on it"
    }
  ])("$name", ({ expected, row }) => {
    assert.strictEqual(toolLabel(row), expected)
  })
})
