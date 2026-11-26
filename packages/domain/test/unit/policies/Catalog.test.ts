import { Usdc } from "@bluechip/domain/market/Units"
import { AgentSpec, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { catalogInfo, checkSpec, compareSpecs, complete, describeSpec } from "@bluechip/domain/policies/Catalog"
import { gasBudget } from "@bluechip/domain/policies/GasBudget"
import { configOf } from "@bluechip/domain/policies/Policy"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import { changed, PICKER, REBALANCER, without } from "../../fixtures/Specs.ts"

describe("checkSpec", () => {
  it.each<{ name: string; spec: AgentSpec; expected: ReadonlyArray<readonly [PolicyId, string | null, string]> }>([
    { name: "a balanced Stock picker", spec: PICKER, expected: [] },
    { name: "a balanced Rebalancer", spec: REBALANCER, expected: [] },
    {
      name: "no trade policy",
      spec: without(PICKER, "trade"),
      expected: [["trade", null, "Every agent needs this."]]
    },
    {
      name: "no rules but the required ones",
      spec: without(PICKER, "stockCap", "cashReserve", "slippageBudget"),
      expected: []
    },
    {
      name: "no hidden policies: bluechip adds them",
      spec: without(PICKER, "gasBudget", "anyCall"),
      expected: []
    },
    {
      name: "a policy added twice",
      spec: new AgentSpec({ policies: [...PICKER.policies, { id: "stockCap", config: { maxBps: 2000 } }] }),
      expected: [["stockCap", null, "Each policy can be added once."]]
    },
    {
      name: "no stocks",
      spec: changed(PICKER, { id: "trade", config: { stocks: [] } }),
      expected: [["trade", "stocks", "Pick at least one stock."]]
    },
    {
      name: "a stock picked twice",
      spec: changed(PICKER, { id: "trade", config: { stocks: ["NVDA", "NVDA"] } }),
      expected: [["trade", "stocks", "Each stock can be picked once."]]
    },
    {
      name: "a daily budget of $10,000, past the slider",
      spec: changed(PICKER, { id: "trade", config: { dailyBudget: Usdc.make(10_000_000_000n) } }, {
        id: "tradeSize",
        config: { maxPerTrade: Usdc.make(100_000_000n) }
      }),
      expected: []
    },
    {
      name: "a daily budget of $50,000,000: no ceiling on a custom amount",
      spec: changed(PICKER, { id: "trade", config: { dailyBudget: Usdc.make(50_000_000_000_000n) } }),
      expected: []
    },
    {
      name: "a seller with a daily budget",
      spec: changed(PICKER, { id: "trade", config: { direction: "sell" } }),
      expected: [["trade", "dailyBudget", "An agent that only sells never spends."]]
    },
    {
      name: "a buyer without a daily budget",
      spec: changed(PICKER, { id: "trade", config: { direction: "buy", dailyBudget: Usdc.make(0n) } }),
      expected: [["trade", "dailyBudget", "Give it a daily budget to buy with."]]
    },
    {
      name: "a rebalancing direction without a target mix",
      spec: without(REBALANCER, "rebalance"),
      expected: [["trade", "direction", "Set a target mix to rebalance toward."]]
    },
    {
      name: "a target mix on an agent that trades both ways",
      spec: changed(REBALANCER, { id: "trade", config: { direction: "both" } }),
      expected: [["rebalance", null, "Only an agent that rebalances has a target mix."]]
    },
    {
      name: "the largest trade at $10",
      spec: changed(PICKER, { id: "tradeSize", config: { maxPerTrade: Usdc.make(10_000_000n) } }),
      expected: []
    },
    {
      name: "the largest trade a unit under $10",
      spec: changed(PICKER, { id: "tradeSize", config: { maxPerTrade: Usdc.make(9_999_999n) } }),
      expected: [["tradeSize", "maxPerTrade", "At least $10."]]
    },
    {
      name: "the largest trade over the daily budget",
      spec: changed(PICKER, { id: "tradeSize", config: { maxPerTrade: Usdc.make(300_000_000n) } }),
      expected: [["tradeSize", "maxPerTrade", "Can't be more than the daily budget ($250)."]]
    },
    {
      name: "a seller's largest trade, with no budget to stay under",
      spec: changed(PICKER, { id: "trade", config: { direction: "sell", dailyBudget: Usdc.make(0n) } }, {
        id: "tradeSize",
        config: { maxPerTrade: Usdc.make(1_000_000_000n) }
      }),
      expected: []
    },
    {
      name: "the smallest trade over the largest",
      spec: changed(PICKER, {
        id: "tradeSize",
        config: { maxPerTrade: Usdc.make(20_000_000n), minPerTrade: Usdc.make(25_000_000n) }
      }),
      expected: [["tradeSize", "minPerTrade", "Can't be more than the largest trade."]]
    },
    {
      name: "price protection a basis point over 5%",
      spec: changed(PICKER, { id: "fairPrice", config: { collarBps: 501 } }),
      expected: [["fairPrice", "collarBps", "Pick 0.1% to 5%."]]
    },
    {
      name: "a Rebalancer trading while prices are paused, under the tighter limit",
      spec: changed(REBALANCER, { id: "fairPrice", config: { tradeWhilePaused: true } }),
      expected: []
    },
    {
      name: "max in one stock under 5%",
      spec: changed(PICKER, { id: "stockCap", config: { maxBps: 499 } }),
      expected: [["stockCap", "maxBps", "Pick 5% to 100%."]]
    },
    {
      name: "a cash reserve and max in one stock past 100%",
      spec: changed(PICKER, { id: "stockCap", config: { maxBps: 9500 } }),
      expected: [["cashReserve", "minBps", "Cash reserve plus max in one stock can't pass 100%."]]
    },
    {
      name: "a cash reserve of 100% without a stock cap",
      spec: changed(without(PICKER, "stockCap"), { id: "cashReserve", config: { minBps: 5000 } }),
      expected: []
    },
    {
      name: "2,001 trades a day",
      spec: changed(PICKER, { id: "tradesPerDay", config: { count: 2001 } }),
      expected: [["tradesPerDay", "count", "Pick 1 to 2000."]]
    },
    {
      name: "an empty target mix",
      spec: changed(REBALANCER, { id: "rebalance", config: { targets: [] } }),
      expected: [["rebalance", "targets", "Set a target mix."]]
    },
    {
      name: "a stock without a target",
      spec: changed(REBALANCER, {
        id: "rebalance",
        config: { targets: [{ asset: "NVDA", weight: 6000 }, { asset: "USDC", weight: 4000 }] }
      }),
      expected: [["rebalance", "targets", "Give every stock a target."]]
    },
    {
      name: "a target for a stock it doesn't trade",
      spec: changed(REBALANCER, {
        id: "rebalance",
        config: {
          targets: [{ asset: "NVDA", weight: 2000 }, { asset: "AAPL", weight: 2000 }, { asset: "TSLA", weight: 2000 }, {
            asset: "USDC",
            weight: 4000
          }]
        }
      }),
      expected: [["rebalance", "targets", "The mix can only hold the stocks this agent trades, and cash."]]
    },
    {
      name: "a mix that adds up to 99.99%",
      spec: changed(REBALANCER, {
        id: "rebalance",
        config: {
          targets: [{ asset: "NVDA", weight: 3000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 3999 }]
        }
      }),
      expected: [["rebalance", "targets", "The mix has to add up to 100%."]]
    },
    {
      name: "a stock's target over the max in one stock",
      spec: changed(REBALANCER, {
        id: "rebalance",
        config: {
          targets: [{ asset: "NVDA", weight: 3100 }, { asset: "AAPL", weight: 2900 }, { asset: "USDC", weight: 4000 }]
        }
      }),
      expected: [["rebalance", "targets", "No stock's target can pass the max in one stock (30%)."]]
    },
    {
      name: "cash's target under the cash reserve",
      spec: changed(REBALANCER, {
        id: "rebalance",
        config: {
          targets: [{ asset: "NVDA", weight: 3000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 4000 }]
        }
      }, { id: "cashReserve", config: { minBps: 4500 } }),
      expected: [["rebalance", "targets", "Cash's target can't be under the cash reserve (45%)."]]
    }
  ])("$name", ({ expected, spec }) => {
    const problems = checkSpec(spec).map(({ field, message, policy }) => [policy, field, message] as const)

    assert.deepStrictEqual(problems, expected)
  })
})

describe("complete", () => {
  it("adds the hidden policies with bluechip's defaults", () => {
    const spec = complete(without(PICKER, "gasBudget", "anyCall"))

    assert.deepStrictEqual(spec.policies.slice(-2), [
      { id: "gasBudget", config: { weiPerDay: 50_000_000_000_000_000n } },
      { id: "anyCall", config: {} }
    ])
  })

  it("replaces a hidden policy's configuration with bluechip's", () => {
    const spec = complete(changed(PICKER, { id: "gasBudget", config: { weiPerDay: 1n } }))

    assert.deepStrictEqual(configOf(spec.policies, gasBudget), { weiPerDay: 50_000_000_000_000_000n })
  })

  it("lists policies in the catalog's order", () => {
    const spec = complete(new AgentSpec({ policies: [...PICKER.policies].reverse() }))

    assert.deepStrictEqual(spec.policies.map((entry) => entry.id), [
      "trade",
      "tradeSize",
      "fairPrice",
      "stockCap",
      "cashReserve",
      "slippageBudget",
      "tradesPerDay",
      "gasBudget",
      "anyCall"
    ])
  })
})

describe("compareSpecs", () => {
  it.each<{ name: string; after: AgentSpec; expected: ReturnType<typeof compareSpecs> }>([
    { name: "the same policies", after: PICKER, expected: { overall: "same", policies: [] } as never },
    {
      name: "a lower daily budget",
      after: changed(PICKER, { id: "trade", config: { dailyBudget: Usdc.make(100_000_000n) } }),
      expected: { overall: "tighter", policies: [{ policy: "trade", change: "tighter" }] } as never
    },
    {
      name: "a stock added",
      after: changed(PICKER, { id: "trade", config: { stocks: ["NVDA", "AAPL", "TSLA"] } }),
      expected: { overall: "looser", policies: [{ policy: "trade", change: "looser" }] } as never
    },
    {
      name: "a stock dropped",
      after: changed(PICKER, { id: "trade", config: { stocks: ["NVDA"] } }),
      expected: { overall: "tighter", policies: [{ policy: "trade", change: "tighter" }] } as never
    },
    {
      name: "both ways narrowed to buys",
      after: changed(PICKER, { id: "trade", config: { direction: "buy" } }),
      expected: { overall: "tighter", policies: [{ policy: "trade", change: "tighter" }] } as never
    },
    {
      name: "a rule removed",
      after: without(PICKER, "stockCap"),
      expected: { overall: "looser", policies: [{ policy: "stockCap", change: "removed" }] } as never
    },
    {
      name: "a higher cash reserve and a bigger largest trade",
      after: changed(PICKER, { id: "cashReserve", config: { minBps: 2000 } }, {
        id: "tradeSize",
        config: { maxPerTrade: Usdc.make(200_000_000n) }
      }),
      expected: {
        overall: "looser",
        policies: [{ policy: "tradeSize", change: "looser" }, { policy: "cashReserve", change: "tighter" }]
      } as never
    },
    {
      name: "trading while prices are paused turned off",
      after: changed(PICKER, { id: "fairPrice", config: { tradeWhilePaused: false } }),
      expected: { overall: "tighter", policies: [{ policy: "fairPrice", change: "tighter" }] } as never
    },
    {
      name: "a wider collar",
      after: changed(PICKER, { id: "fairPrice", config: { collarBps: 200 } }),
      expected: { overall: "looser", policies: [{ policy: "fairPrice", change: "looser" }] } as never
    },
    {
      name: "fewer trades a day",
      after: changed(PICKER, { id: "tradesPerDay", config: { count: 4 } }),
      expected: { overall: "tighter", policies: [{ policy: "tradesPerDay", change: "tighter" }] } as never
    },
    {
      name: "a lower slippage budget and a lower stock cap",
      after: changed(PICKER, { id: "slippageBudget", config: { weeklyBps: 50 } }, {
        id: "stockCap",
        config: { maxBps: 2000 }
      }),
      expected: {
        overall: "tighter",
        policies: [{ policy: "stockCap", change: "tighter" }, { policy: "slippageBudget", change: "tighter" }]
      } as never
    }
  ])("$name", ({ after, expected }) => {
    const changes = compareSpecs(PICKER, after)

    assert.deepStrictEqual(
      { overall: changes.overall, policies: changes.policies.map(({ change, policy }) => ({ policy, change })) },
      expected
    )
  })

  it("buys turned into sells", () => {
    const buyer = changed(PICKER, { id: "trade", config: { direction: "buy" } })

    const changes = compareSpecs(buyer, changed(buyer, { id: "trade", config: { direction: "sell" } }))

    assert.strictEqual(changes.overall, "looser")
  })

  it("a rule added to the policies in force", () => {
    const changes = compareSpecs(without(PICKER, "stockCap"), PICKER)

    assert.deepStrictEqual(
      { overall: changes.overall, policies: changes.policies.map(({ change, policy }) => ({ policy, change })) },
      { overall: "tighter", policies: [{ policy: "stockCap", change: "added" }] }
    )
  })

  it.each<{ name: string; after: AgentSpec }>([
    {
      name: "a new target mix",
      after: changed(REBALANCER, {
        id: "rebalance",
        config: {
          targets: [{ asset: "NVDA", weight: 2000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 5000 }]
        }
      })
    },
    { name: "a lower trigger", after: changed(REBALANCER, { id: "rebalance", config: { triggerBps: 300 } }) }
  ])("$name loosens the Rebalancer", ({ after }) => {
    assert.strictEqual(compareSpecs(REBALANCER, after).overall, "looser")
  })
})

describe("describeSpec", () => {
  const NAMES: Record<string, string> = { NVDA: "Nvidia", AAPL: "Apple", TSLA: "Tesla", MSFT: "Microsoft" }

  it("a balanced Stock picker", () => {
    const description = describeSpec(PICKER, (symbol) => NAMES[symbol] ?? symbol)

    assert.deepStrictEqual({ can: description.can, never: description.never }, {
      can: [
        "Buy and sell Nvidia and Apple",
        "Spend up to $250 a day",
        "Trade up to $100 at a time, and ask you before anything bigger",
        "Trade on weekends and holidays, with a tighter price limit",
        "Trade 500 times a day at most"
      ],
      never: [
        "Send money out of your account",
        "Trade stocks you didn't pick",
        "Make a trade under $5",
        "Trade more than 1% away from Chainlink's price",
        "Put over 30% of your money in one stock",
        "Leave less than 10% in cash",
        "Lose more than 1% of your money to prices in a week",
        "Change its own policies"
      ]
    })
  })

  it("a conservative Rebalancer of four stocks", () => {
    const spec = draftSpec({
      template: "rebalancer",
      preset: "conservative",
      stocks: ["NVDA", "AAPL", "TSLA", "MSFT"],
      targets: [
        { asset: "NVDA", weight: 1500 },
        { asset: "AAPL", weight: 1500 },
        { asset: "TSLA", weight: 1500 },
        { asset: "MSFT", weight: 1500 },
        { asset: "USDC", weight: 4000 }
      ]
    })

    const description = describeSpec(spec, (symbol) => NAMES[symbol] ?? symbol)

    assert.deepStrictEqual({ can: description.can, never: description.never }, {
      can: [
        "Trade Nvidia, Apple, Tesla and 1 more, only to move you back to your target mix",
        "Spend up to $500 a day",
        "Trade up to $200 at a time, and ask you before anything bigger",
        "Trade on weekends and holidays, with a tighter price limit",
        "Start rebalancing once your mix is 5% off target",
        "Trade 500 times a day at most"
      ],
      never: [
        "Send money out of your account",
        "Trade stocks you didn't pick",
        "Make a trade under $5",
        "Trade more than 1% away from Chainlink's price",
        "Put over 20% of your money in one stock",
        "Leave less than 20% in cash",
        "Trade away from your target mix",
        "Lose more than 1% of your money to prices in a week",
        "Change its own policies"
      ]
    })
  })

  it("a Stop-loss guard trading once a day, with no cap on one stock", () => {
    const spec = changed(
      draftSpec({ template: "stopLossGuard", preset: "balanced", stocks: ["NVDA"], targets: [] }),
      { id: "tradesPerDay", config: { count: 1 } },
      { id: "stockCap", config: { maxBps: 10_000 } }
    )

    const description = describeSpec(spec, (symbol) => NAMES[symbol] ?? symbol)

    assert.deepStrictEqual(description.can, [
      "Sell Nvidia",
      "Trade up to $100 at a time, and ask you before anything bigger",
      "Trade on weekends and holidays, with a tighter price limit",
      "Trade once a day at most"
    ])
  })
})

describe("catalogInfo", () => {
  it("describes the trade policy with its fields, defaults and JSON Schema", () => {
    const trade = catalogInfo().find((policy) => policy.id === "trade")!

    assert.deepStrictEqual(
      {
        fields: trade.fields.map(({ field, name }) => [name, field.unit]),
        defaults: trade.defaults,
        properties: Object.keys((trade.schema as { schema: { properties: object } }).schema.properties)
      },
      {
        fields: [["stocks", "stocks"], ["direction", "direction"], ["dailyBudget", "usd"]],
        defaults: { stocks: [], direction: "both", dailyBudget: "250000000" },
        properties: ["stocks", "direction", "dailyBudget"]
      }
    )
  })

  it("lists every policy once, hidden ones marked", () => {
    assert.deepStrictEqual(catalogInfo().map((policy) => [policy.id, policy.hidden]), [
      ["trade", false],
      ["tradeSize", false],
      ["fairPrice", false],
      ["stockCap", false],
      ["cashReserve", false],
      ["rebalance", false],
      ["stopLossFloor", false],
      ["slippageBudget", false],
      ["tradesPerDay", false],
      ["gasBudget", true],
      ["anyCall", true]
    ])
  })
})
