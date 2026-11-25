// What every tool of the toolkit must satisfy, so a new tool is checked by being registered.
import { Card } from "@bluechip/domain/assistant/Card"
import { type RiskLevel, riskOf } from "@bluechip/domain/tools/Risk"
import { BluechipToolkit } from "@bluechip/domain/tools/Toolkit"
import { assert, describe, it } from "@effect/vitest"
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
