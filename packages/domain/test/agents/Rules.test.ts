import { Limits, Target } from "@bluechip/domain/agents/Limits"
import { compare, describe as describeLimits, validate } from "@bluechip/domain/agents/Rules"
import { draftLimits, Preset, PRESETS, Template, TEMPLATES } from "@bluechip/domain/agents/Templates"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

const dollars = (amount: number) => Usdc.make(BigInt(amount) * BigInt(1_000_000))

const picker = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

const rebalancer = draftLimits({
  template: "rebalancer",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: [
    new Target({ asset: "NVDA", weight: 3000 }),
    new Target({ asset: "AAPL", weight: 3000 }),
    new Target({ asset: "USDC", weight: 4000 })
  ]
})

const fieldsOf = (limits: Limits, template: Template) => validate(limits, template).map((problem) => problem.field)

describe("Templates", () => {
  it("drafts valid limits for every template and preset", () => {
    for (const template of Template.literals) {
      for (const preset of Preset.literals) {
        const limits = draftLimits({
          template,
          preset,
          stocks: ["NVDA"],
          targets: [new Target({ asset: "NVDA", weight: 2000 }), new Target({ asset: "USDC", weight: 8000 })]
        })
        assert.deepStrictEqual(validate(limits, template), [], `${template} ${preset}`)
      }
    }
  })

  it("keeps a preset's budget under the template's ceiling", () => {
    const buyer = draftLimits({ template: "weeklyBuyer", preset: "active", stocks: ["NVDA"], targets: [] })
    assert.strictEqual(buyer.dailyBudget, TEMPLATES.weeklyBuyer.maxDailyBudget)

    const guard = draftLimits({ template: "stopLossGuard", preset: "active", stocks: ["NVDA"], targets: [] })
    assert.strictEqual(guard.dailyBudget, dollars(0))
    assert.strictEqual(PRESETS.active.dailyBudget, dollars(1000))
  })
})

describe("validate", () => {
  it("needs stocks, each once", () => {
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, stocks: [] }), "stockPicker"), ["stocks"])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, stocks: ["NVDA", "NVDA"] }), "stockPicker"), ["stocks"])
  })

  it("keeps each number in its range and the template's ceiling", () => {
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, dailyBudget: dollars(2001) }), "stockPicker"), [
      "dailyBudget"
    ])
    assert.deepStrictEqual(
      fieldsOf(
        new Limits({ ...picker, dailyBudget: dollars(10), maxPerTrade: dollars(10), mode: "sell" }),
        "stopLossGuard"
      ),
      ["dailyBudget"]
    )
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, maxPerTrade: dollars(5) }), "stockPicker"), [
      "maxPerTrade"
    ])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, askAbove: dollars(1001) }), "stockPicker"), ["askAbove"])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, maxInOneStock: 499 }), "stockPicker"), ["maxInOneStock"])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, cashReserve: 5001 }), "stockPicker"), ["cashReserve"])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, tradesPerDay: 0 }), "stockPicker"), ["tradesPerDay"])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, tradesPerDay: 49 }), "stockPicker"), ["tradesPerDay"])
  })

  it("accepts the bounds themselves", () => {
    const edges = new Limits({
      ...picker,
      dailyBudget: dollars(2000),
      maxPerTrade: dollars(1000),
      askAbove: dollars(0),
      maxInOneStock: 5000,
      cashReserve: 5000,
      tradesPerDay: 48
    })
    assert.deepStrictEqual(validate(edges, "stockPicker"), [])
  })

  it("keeps a trade inside the daily budget, and the reserve and cap inside 100%", () => {
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, maxPerTrade: dollars(300) }), "stockPicker"), [
      "maxPerTrade"
    ])
    assert.deepStrictEqual(
      fieldsOf(new Limits({ ...picker, maxInOneStock: 6000, cashReserve: 4001 }), "stockPicker"),
      ["cashReserve"]
    )
  })

  it("holds the template's mode, and a Rebalancer to live prices", () => {
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, mode: "buy" }), "stockPicker"), ["mode"])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...rebalancer, tradeWhilePaused: true }), "rebalancer"), [
      "tradeWhilePaused"
    ])
  })

  it("checks a Rebalancer's target mix", () => {
    const withTargets = (targets: ReadonlyArray<[string, number]>) =>
      fieldsOf(
        new Limits({
          ...rebalancer,
          targets: targets.map(([asset, weight]) => Schema.decodeUnknownSync(Target)({ asset, weight }))
        }),
        "rebalancer"
      )

    assert.deepStrictEqual(validate(rebalancer, "rebalancer"), [])
    assert.deepStrictEqual(withTargets([]), ["targets"])
    assert.deepStrictEqual(withTargets([["NVDA", 3000], ["AAPL", 3000], ["USDC", 3999]]), ["targets"])
    assert.deepStrictEqual(withTargets([["NVDA", 6000], ["USDC", 4000]]), ["targets"])
    assert.deepStrictEqual(withTargets([["NVDA", 3000], ["AAPL", 3000], ["TSLA", 1000], ["USDC", 3000]]), [
      "targets"
    ])
    assert.deepStrictEqual(withTargets([["NVDA", 3500], ["AAPL", 3500], ["USDC", 3000]]), ["targets"])
    assert.deepStrictEqual(withTargets([["NVDA", 4500], ["AAPL", 4500], ["USDC", 1000]]), ["targets"])
    assert.deepStrictEqual(fieldsOf(new Limits({ ...picker, targets: rebalancer.targets }), "stockPicker"), [
      "targets"
    ])
  })
})

describe("compare", () => {
  it("calls each field's change tighter or looser", () => {
    const tighter = new Limits({
      ...picker,
      dailyBudget: dollars(100),
      cashReserve: 2000,
      stocks: ["NVDA"],
      tradeWhilePaused: false,
      priceProtection: 50
    })
    const changes = compare(picker, tighter)
    assert.strictEqual(changes.overall, "tighter")
    assert.strictEqual(changes.fields.dailyBudget, "tighter")
    assert.strictEqual(changes.fields.cashReserve, "tighter")
    assert.strictEqual(changes.fields.stocks, "tighter")
    assert.strictEqual(changes.fields.tradeWhilePaused, "tighter")
    assert.strictEqual(changes.fields.priceProtection, "tighter")
    assert.strictEqual(changes.fields.maxPerTrade, "same")
  })

  it("is looser when any field is, and for a new target mix", () => {
    const mixed = new Limits({ ...picker, dailyBudget: dollars(100), stocks: ["NVDA", "AAPL", "TSLA"] })
    assert.strictEqual(compare(picker, mixed).overall, "looser")
    assert.strictEqual(compare(picker, picker).overall, "same")

    const moved = new Limits({
      ...rebalancer,
      targets: [
        new Target({ asset: "NVDA", weight: 2500 }),
        new Target({ asset: "AAPL", weight: 2500 }),
        new Target({ asset: "USDC", weight: 5000 })
      ]
    })
    assert.strictEqual(compare(rebalancer, moved).fields.targets, "looser")
    assert.strictEqual(compare(rebalancer, new Limits({ ...rebalancer, rebalanceTrigger: 1000 })).overall, "tighter")
  })
})

describe("describe", () => {
  const name = (symbol: string) => ({ NVDA: "NVIDIA", AAPL: "Apple", TSLA: "Tesla", MSFT: "Microsoft" })[symbol]!

  it("says what an agent can and can never do", () => {
    assert.deepStrictEqual(describeLimits(picker, name), {
      can: [
        "Buy and sell NVIDIA and Apple",
        "Spend up to $250 a day",
        "Trade up to $100 at a time, 12 times a day at most",
        "Ask you before trades over $150",
        "Trade on weekends and holidays, with a tighter price limit"
      ],
      never: [
        "Send money out of your account",
        "Put over 30% of your money in one stock",
        "Leave less than 10% in cash",
        "Trade more than 1% away from Chainlink's price",
        "Lose more than 1% of your money to prices in a week",
        "Change its own limits"
      ]
    })
  })

  it("names a Rebalancer's job and its live-price rule", () => {
    const { can, never } = describeLimits(rebalancer, name)
    assert.strictEqual(can[0], "Trade NVIDIA and Apple, only to move you back to your target mix")
    assert.include(never, "Trade while prices are paused")
  })

  it("never writes a dot separator", () => {
    const { can, never } = describeLimits(
      new Limits({ ...picker, stocks: ["NVDA", "AAPL", "TSLA", "MSFT"], askAbove: dollars(0) }),
      name
    )
    assert.include(can, "Ask you before every trade")
    assert.include(can, "Buy and sell NVIDIA, Apple, Tesla and 1 more")
    for (const sentence of [...can, ...never]) assert.notInclude(sentence, "·")
  })
})
