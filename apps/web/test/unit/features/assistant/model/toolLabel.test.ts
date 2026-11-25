import { assert, describe, it } from "@effect/vitest"
import type { ToolRow } from "../../../../../src/features/assistant/model/thread.ts"
import { toolLabel } from "../../../../../src/features/assistant/model/toolLabel.ts"

describe("toolLabel", () => {
  it.each<{ name: string; row: ToolRow; expected: string }>([
    {
      name: "running",
      row: { id: "call-1", name: "getPortfolio", state: "running" },
      expected: "Reading your portfolio…"
    },
    { name: "done", row: { id: "call-1", name: "getPortfolio", state: "done" }, expected: "Read your portfolio" },
    {
      name: "failed",
      row: { id: "call-1", name: "getPortfolio", state: "failed" },
      expected: "Didn't finish reading your portfolio"
    },
    {
      name: "web research",
      row: { id: "call-1", name: "AnthropicWebSearch", state: "done" },
      expected: "Searched the web"
    },
    {
      name: "an unknown tool running",
      row: { id: "call-1", name: "later", state: "running" },
      expected: "Working on it…"
    },
    { name: "an unknown tool done", row: { id: "call-1", name: "later", state: "done" }, expected: "Done" },
    {
      name: "an unknown tool failed",
      row: { id: "call-1", name: "later", state: "failed" },
      expected: "Didn't finish working on it"
    }
  ])("$name", ({ expected, row }) => {
    assert.strictEqual(toolLabel(row), expected)
  })
})
