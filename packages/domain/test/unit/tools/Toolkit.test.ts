// What every tool of the toolkit must satisfy, so a new tool is checked by being registered.
import { Card } from "@bluechip/domain/assistant/Card"
import { type RiskLevel, riskOf } from "@bluechip/domain/tools/Risk"
import { BluechipToolkit } from "@bluechip/domain/tools/Toolkit"
import { assert, describe, it } from "@effect/vitest"
import { toCodecAnthropic } from "effect/ai/AnthropicStructuredOutput"
import * as Tool from "effect/ai/Tool"
import * as SchemaAST from "effect/SchemaAST"

const tools = Object.values(BluechipToolkit.tools) as ReadonlyArray<Tool.Any>

describe("the toolkit", () => {
  it("gives each tool the risk level of the plan", () => {
    const levels = Object.fromEntries(tools.map((tool) => [tool.name, riskOf(tool)]))

    assert.deepStrictEqual(
      levels,
      {
        getPortfolio: "read",
        getPrices: "read",
        getQuote: "read",
        getStock: "read",
        getActivity: "read",
        listAgents: "read",
        getAgent: "read",
        getAgentUsage: "read",
        getAgentHistory: "read",
        explainDecision: "read",
        listPolicies: "read",
        listTemplates: "read",
        checkAgentSpec: "read",
        proposeTrade: "propose",
        proposeRebalance: "propose",
        pauseAgent: "configure",
        resumeAgent: "configure",
        pauseAll: "configure",
        saveTemplate: "configure",
        draftAgent: "sign",
        changeAgentPolicies: "sign",
        renewAgent: "sign",
        removeAgent: "sign",
        remember: "configure",
        forget: "configure",
        listMemories: "read"
      } satisfies Record<string, RiskLevel>
    )
  })

  it.each(tools)("$name: tells the model what it does", (tool) => {
    assert.isAbove(Tool.getDescription(tool)?.length ?? 0, 20)
  })

  it.each(tools)("$name: its parameters have a JSON Schema the model can read", (tool) => {
    assert.strictEqual(Tool.getJsonSchema(tool).type, "object")
  })

  it.each(tools)(
    "$name: its parameters' JSON Schema has no definitions, which Anthropic rejects when named with slashes",
    (tool) => {
      const schema = JSON.stringify(Tool.getJsonSchema(tool, { transformer: toCodecAnthropic }))

      assert.notInclude(schema, "$defs")
    }
  )

  it("stays within Anthropic's strict limits: 20 strict tools, 16 nullable or union parameters across them", () => {
    const strict = tools.filter((tool) => Tool.getStrictMode(tool) === true)
    const unions = strict.flatMap((tool) =>
      JSON.stringify(Tool.getJsonSchema(tool, { transformer: toCodecAnthropic })).match(/"anyOf"/g) ?? []
    )

    assert.deepStrictEqual([strict.length <= 20, unions.length <= 16], [true, true])
  })

  it.each(tools.filter((tool) => Tool.getStrictMode(tool) === true))(
    "$name: strict, with no string pattern, which held constrained decoding in a loop",
    (tool) => {
      const schema = JSON.stringify(Tool.getJsonSchema(tool, { transformer: toCodecAnthropic }))

      assert.notInclude(schema, "\"pattern\"")
    }
  )

  it.each(tools)("$name: returns its refusals to the model instead of failing the run", (tool) => {
    assert.strictEqual(tool.failureMode, "return")
  })

  it.each(tools)("$name: gives the model words, not raw amounts", (tool) => {
    assert.isFunction(tool.toModelOutput)
  })

  it.each(tools.filter((tool) => riskOf(tool) !== "read"))("$name: acts only through a card", (tool) => {
    const ast = tool.successSchema.ast
    const returned = SchemaAST.isArrays(ast) ? ast.rest[0] : ast

    assert.strictEqual(returned, Card.ast)
  })
})
