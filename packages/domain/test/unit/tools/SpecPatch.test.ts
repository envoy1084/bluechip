import { SavedTemplateId } from "@bluechip/domain/Ids"
import { PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import { fairPrice } from "@bluechip/domain/policies/FairPrice"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import { applyPatch, draftAgentSpec } from "@bluechip/domain/tools/SpecPatch"
import { assert, describe, it } from "@effect/vitest"
import { PICKER, REBALANCER } from "../../fixtures/Specs.ts"

const SAVED = SavedTemplateId.make("template_01jd8v4t5m6n7a8q9r0s1t2v3w")

describe("applyPatch", () => {
  it("no changes keep the spec, with no problems", () => {
    const result = applyPatch(PICKER, {})

    assert.deepStrictEqual(result, { spec: PICKER, problems: [] })
  })

  it("a dollar setting is written in micro-dollars", () => {
    const { problems, spec } = applyPatch(PICKER, {
      settings: [{ policy: "tradeSize", field: "maxPerTrade", value: 50 }]
    })

    assert.deepStrictEqual([configOf(spec.policies, tradeSize)?.maxPerTrade, problems], [50_000_000n, []])
  })

  it("cents are kept", () => {
    const { spec } = applyPatch(PICKER, { settings: [{ policy: "tradeSize", field: "minPerTrade", value: 5.5 }] })

    assert.strictEqual(configOf(spec.policies, tradeSize)?.minPerTrade, 5_500_000n)
  })

  it("a percent setting is written in basis points", () => {
    const { spec } = applyPatch(PICKER, { settings: [{ policy: "stockCap", field: "maxBps", value: 25 }] })

    assert.strictEqual(configOf(spec.policies, stockCap)?.maxBps, 2500)
  })

  it("a count is rounded to a whole number", () => {
    const { spec } = applyPatch(PICKER, { settings: [{ policy: "tradesPerDay", field: "count", value: 3.4 }] })

    assert.strictEqual(configOf(spec.policies, tradesPerDay)?.count, 3)
  })

  it("a toggle takes true or false", () => {
    const { spec } = applyPatch(PICKER, {
      settings: [{ policy: "fairPrice", field: "tradeWhilePaused", value: false }]
    })

    assert.strictEqual(configOf(spec.policies, fairPrice)?.tradeWhilePaused, false)
  })

  it("a toggle given a number is a problem, and the spec keeps its value", () => {
    const { problems, spec } = applyPatch(PICKER, {
      settings: [{ policy: "fairPrice", field: "tradeWhilePaused", value: 1 }]
    })

    assert.deepStrictEqual([configOf(spec.policies, fairPrice)?.tradeWhilePaused, problems], [true, [
      new PolicyProblem({
        policy: "fairPrice",
        field: "tradeWhilePaused",
        message: "This setting doesn't exist or can't take that value."
      })
    ]])
  })

  it("a field the policy doesn't have is a problem", () => {
    const { problems } = applyPatch(PICKER, { settings: [{ policy: "tradeSize", field: "maxPerDay", value: 10 }] })

    assert.deepStrictEqual(problems, [
      new PolicyProblem({
        policy: "tradeSize",
        field: "maxPerDay",
        message: "This setting doesn't exist or can't take that value."
      })
    ])
  })

  it("a setting of a policy the agent doesn't carry is a problem", () => {
    const { problems } = applyPatch(PICKER, { settings: [{ policy: "rebalance", field: "triggerBps", value: 5 }] })

    assert.deepStrictEqual(problems, [
      new PolicyProblem({
        policy: "rebalance",
        field: "triggerBps",
        message: "The agent doesn't have this policy; add it first."
      })
    ])
  })

  it("a setting out of range is reported by the catalog's check", () => {
    const { problems } = applyPatch(PICKER, {
      settings: [{ policy: "tradeSize", field: "maxPerTrade", value: 2 }]
    })

    assert.deepStrictEqual(problems.map((problem) => [problem.policy, problem.field, problem.message]), [
      ["tradeSize", "maxPerTrade", "At least $10."],
      ["tradeSize", "minPerTrade", "Can't be more than the largest trade."]
    ])
  })

  it("removing a required policy is a problem, and it stays", () => {
    const { problems, spec } = applyPatch(PICKER, { remove: ["tradeSize"] })

    assert.deepStrictEqual(
      [spec.policies.some((entry) => entry.id === "tradeSize"), problems],
      [true, [new PolicyProblem({ policy: "tradeSize", field: null, message: "Every agent has this." })]]
    )
  })

  it("new stocks replace the old ones", () => {
    const { spec } = applyPatch(PICKER, { stocks: ["TSLA"] })

    assert.deepStrictEqual(configOf(spec.policies, trade)?.stocks, ["TSLA"])
  })

  it("a rebalancer's mix is given in percent", () => {
    const { problems, spec } = applyPatch(REBALANCER, {
      targets: [{ asset: "NVDA", percent: 25 }, { asset: "AAPL", percent: 25 }, { asset: "USDC", percent: 50 }]
    })

    assert.deepStrictEqual([configOf(spec.policies, rebalance)?.targets, problems], [[
      { asset: "NVDA", weight: 2500 },
      { asset: "AAPL", weight: 2500 },
      { asset: "USDC", weight: 5000 }
    ], []])
  })

  it("a mix for an agent that doesn't rebalance is a problem", () => {
    const { problems } = applyPatch(PICKER, { targets: [{ asset: "USDC", percent: 100 }] })

    assert.deepStrictEqual(problems, [
      new PolicyProblem({ policy: "rebalance", field: "targets", message: "Only a rebalancer has a target mix." })
    ])
  })

  it("turning a picker into a rebalancer adds an even mix", () => {
    const { problems, spec } = applyPatch(PICKER, { direction: "rebalance" })

    assert.deepStrictEqual([configOf(spec.policies, rebalance)?.targets, problems], [[
      { asset: "NVDA", weight: 3000 },
      { asset: "AAPL", weight: 3000 },
      { asset: "USDC", weight: 4000 }
    ], []])
  })
})

describe("draftAgentSpec", () => {
  it("a balanced picker of two stocks is the template's spec", () => {
    const result = draftAgentSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"] })

    assert.deepStrictEqual(result, { spec: PICKER, problems: [] })
  })

  it("changes apply on top of the template", () => {
    const { problems, spec } = draftAgentSpec({
      template: "stockPicker",
      preset: "balanced",
      stocks: ["NVDA"],
      changes: { settings: [{ policy: "trade", field: "dailyBudget", value: 200 }] }
    })

    assert.deepStrictEqual([configOf(spec.policies, trade)?.dailyBudget, problems], [200_000_000n, []])
  })

  it("a saved template keeps its own spec and amounts when the draft names no stocks", () => {
    const result = draftAgentSpec({ template: SAVED, preset: "active", stocks: [] }, PICKER)

    assert.deepStrictEqual(result, { spec: PICKER, problems: [] })
  })

  it("a saved template takes the draft's stocks", () => {
    const { problems, spec } = draftAgentSpec({ template: SAVED, preset: "balanced", stocks: ["AAPL"] }, PICKER)

    assert.deepStrictEqual([configOf(spec.policies, trade)?.stocks, problems], [["AAPL"], []])
  })

  it("a picker with no stocks has the catalog's problem", () => {
    const { problems } = draftAgentSpec({ template: "stockPicker", preset: "balanced", stocks: [] })

    assert.deepStrictEqual(problems.map((problem) => problem.policy), ["trade"])
  })
})
