import { Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { cashReserve } from "@bluechip/domain/policies/CashReserve"
import { checkSpec } from "@bluechip/domain/policies/Catalog"
import { fairPrice } from "@bluechip/domain/policies/FairPrice"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance, type Target } from "@bluechip/domain/policies/Rebalance"
import {
  addPolicy,
  applyPreset,
  cantAdd,
  cantRemove,
  evenTargets,
  hasPolicy,
  presetOf,
  removePolicy,
  scratchSpec,
  setDirection,
  setStocks,
  templateSpec
} from "@bluechip/domain/policies/SpecEdits"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { Preset } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { assert, describe, it } from "@effect/vitest"

const PICKER = templateSpec("stockPicker", "balanced", ["NVDA", "AAPL"])
const REBALANCER = templateSpec("rebalancer", "balanced", ["NVDA", "AAPL"])

describe("evenTargets", () => {
  it.each<{ name: string; stocks: ReadonlyArray<"NVDA" | "AAPL" | "TSLA" | "MSFT">; expected: ReadonlyArray<Target> }>([
    {
      name: "two stocks under a 30% cap and a 10% reserve: 30% each, cash the rest",
      stocks: ["NVDA", "AAPL"],
      expected: [{ asset: "NVDA", weight: 3000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 4000 }]
    },
    {
      name: "four stocks: 22% each, under the cap and leaving the reserve",
      stocks: ["NVDA", "AAPL", "TSLA", "MSFT"],
      expected: [
        { asset: "NVDA", weight: 2200 },
        { asset: "AAPL", weight: 2200 },
        { asset: "TSLA", weight: 2200 },
        { asset: "MSFT", weight: 2200 },
        { asset: "USDC", weight: 1200 }
      ]
    },
    { name: "no stocks", stocks: [], expected: [] }
  ])("$name", ({ expected, stocks }) => {
    assert.deepStrictEqual(evenTargets(REBALANCER, stocks), expected)
  })
})

describe("setStocks", () => {
  it("a Rebalancer's new stocks start again from an even mix", () => {
    const spec = setStocks(REBALANCER, ["TSLA"])

    assert.deepStrictEqual(configOf(spec.policies, rebalance), {
      targets: [{ asset: "TSLA", weight: 3000 }, { asset: "USDC", weight: 7000 }],
      triggerBps: 500
    })
  })
})

describe("setDirection", () => {
  it("rebalancing adds a target mix and keeps its paused-price setting", () => {
    const spec = setDirection(PICKER, "rebalance")

    assert.deepStrictEqual(
      [hasPolicy(spec, "rebalance"), configOf(spec.policies, fairPrice), checkSpec(spec)],
      [true, configOf(PICKER.policies, fairPrice), []]
    )
  })

  it("leaving rebalancing drops the target mix", () => {
    const spec = setDirection(REBALANCER, "buy")

    assert.deepStrictEqual([hasPolicy(spec, "rebalance"), checkSpec(spec)], [false, []])
  })

  it("selling only sets the daily budget to nothing", () => {
    const spec = setDirection(PICKER, "sell")

    assert.deepStrictEqual(configOf(spec.policies, trade), {
      stocks: ["NVDA", "AAPL"],
      direction: "sell",
      dailyBudget: Usdc.make(0n)
    })
  })

  it("buying again after selling only brings back the standard budget", () => {
    const spec = setDirection(setDirection(PICKER, "sell"), "buy")

    assert.strictEqual(configOf(spec.policies, trade)?.dailyBudget, 250_000_000n)
  })
})

describe("addPolicy and removePolicy", () => {
  it("a removed stock cap comes back at its defaults", () => {
    const spec = addPolicy(removePolicy(PICKER, "stockCap"), "stockCap")

    assert.deepStrictEqual(configOf(spec.policies, stockCap), { maxBps: 3000 })
  })

  it("adding a target mix makes the agent rebalance", () => {
    const spec = addPolicy(PICKER, "rebalance")

    assert.strictEqual(configOf(spec.policies, trade)?.direction, "rebalance")
  })

  it("removing the target mix makes a Rebalancer trade both ways", () => {
    const spec = removePolicy(REBALANCER, "rebalance")

    assert.deepStrictEqual(
      [configOf(spec.policies, trade)?.direction, hasPolicy(spec, "rebalance")],
      ["both", false]
    )
  })
})

describe("cantAdd and cantRemove", () => {
  it.each<{ name: string; spec: AgentSpec; id: PolicyId; expected: string | undefined }>([
    { name: "a required policy", spec: PICKER, id: "trade", expected: "Every agent has this." },
    { name: "an optional rule", spec: PICKER, id: "stockCap", expected: undefined },
    { name: "the fair price a target mix needs", spec: REBALANCER, id: "fairPrice", expected: "Every agent has this." }
  ])("removing $name", ({ expected, id, spec }) => {
    assert.strictEqual(cantRemove(spec, id), expected)
  })

  it("no policy of the catalog conflicts with another today", () => {
    assert.strictEqual(cantAdd(PICKER, "rebalance"), undefined)
  })
})

describe("scratchSpec", () => {
  it("every required policy at its defaults, and nothing else", () => {
    assert.deepStrictEqual(scratchSpec().policies.map((entry) => entry.id), [
      "trade",
      "tradeSize",
      "fairPrice",
      "tradesPerDay",
      "gasBudget",
      "anyCall"
    ])
  })
})

describe("presets", () => {
  it.each(Preset.literals)("a $0 Stock picker has that preset's amounts", (preset) => {
    assert.strictEqual(presetOf(templateSpec("stockPicker", preset, ["NVDA"]), "stockPicker", Preset.literals), preset)
  })

  it("a changed amount is custom", () => {
    const spec = applyPreset(PICKER, "stockPicker", "active")
    const custom = {
      ...spec,
      policies: spec.policies.map((entry) =>
        entry.id === "stockCap" ? { id: "stockCap", config: { maxBps: 2500 } } : entry
      )
    } as AgentSpec

    assert.strictEqual(presetOf(custom, "stockPicker", Preset.literals), undefined)
  })

  it("applying a preset changes only its amounts", () => {
    const spec = applyPreset(setStocks(PICKER, ["TSLA"]), "stockPicker", "conservative")

    assert.deepStrictEqual(
      [
        configOf(spec.policies, trade),
        configOf(spec.policies, tradeSize),
        configOf(spec.policies, stockCap),
        configOf(spec.policies, cashReserve)
      ],
      [
        { stocks: ["TSLA"], direction: "both", dailyBudget: 100_000_000n },
        { maxPerTrade: 50_000_000n, minPerTrade: 5_000_000n },
        { maxBps: 2000 },
        { minBps: 2000 }
      ]
    )
  })
})
