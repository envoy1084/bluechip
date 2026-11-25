import { Limits, Target } from "@bluechip/domain/agents/Limits"
import {
  compare,
  describe as describeLimits,
  type Description,
  type LimitChange,
  type LimitField,
  LimitProblem,
  validate
} from "@bluechip/domain/agents/Rules"
import { draftLimits, type Template } from "@bluechip/domain/agents/Templates"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

const usdc = (dollars: number) => Usdc.make(BigInt(Math.round(dollars * 1_000_000)))

// $250 a day, $100 a trade, ask above $150, 30% in one stock, 10% cash, 12 trades a day, trades while paused.
const PICKER = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

// The same numbers, with a target mix of 30% NVDA, 30% AAPL and 40% cash.
const REBALANCER = draftLimits({
  template: "rebalancer",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: [
    new Target({ asset: "NVDA", weight: 3000 }),
    new Target({ asset: "AAPL", weight: 3000 }),
    new Target({ asset: "USDC", weight: 4000 })
  ]
})

const picker = (changes: Partial<Limits>) => new Limits({ ...PICKER, ...changes })
const rebalancer = (changes: Partial<Limits>) => new Limits({ ...REBALANCER, ...changes })
const mix = (...targets: Array<[Target["asset"], number]>) =>
  targets.map(([asset, weight]) => new Target({ asset, weight }))

describe("validate", () => {
  it.each<{ name: string; limits: Limits; template: Template; expected: ReadonlyArray<[LimitField, string]> }>([
    { name: "a balanced Stock picker", limits: PICKER, template: "stockPicker", expected: [] },
    {
      name: "a mode the template doesn't trade",
      limits: picker({ mode: "buy" }),
      template: "stockPicker",
      expected: [["mode", "This agent can't trade that way."]]
    },
    {
      name: "no stocks",
      limits: picker({ stocks: [] }),
      template: "stockPicker",
      expected: [["stocks", "Pick at least one stock."]]
    },
    {
      name: "a stock picked twice",
      limits: picker({ stocks: ["NVDA", "NVDA"] }),
      template: "stockPicker",
      expected: [["stocks", "Each stock can be picked once."]]
    },
    {
      name: "a daily budget at the $2,000 ceiling",
      limits: picker({ dailyBudget: usdc(2000) }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "a daily budget a unit over the $2,000 ceiling",
      limits: picker({ dailyBudget: usdc(2000.000001) }),
      template: "stockPicker",
      expected: [["dailyBudget", "Pick at most $2,000 a day."]]
    },
    {
      name: "a Weekly buyer's budget at its $500 ceiling",
      limits: picker({ mode: "buy", dailyBudget: usdc(500), tradesPerDay: 1 }),
      template: "weeklyBuyer",
      expected: []
    },
    {
      name: "a Weekly buyer's budget a unit over its $500 ceiling",
      limits: picker({ mode: "buy", dailyBudget: usdc(500.000001) }),
      template: "weeklyBuyer",
      expected: [["dailyBudget", "Pick at most $500 a day."]]
    },
    {
      name: "a Stop-loss guard with a budget",
      limits: picker({ mode: "sell", dailyBudget: usdc(10), maxPerTrade: usdc(10) }),
      template: "stopLossGuard",
      expected: [["dailyBudget", "This agent never buys."]]
    },
    {
      name: "a Stop-loss guard with no budget, trading more than it",
      limits: picker({ mode: "sell", dailyBudget: usdc(0), maxPerTrade: usdc(100) }),
      template: "stopLossGuard",
      expected: []
    },
    {
      name: "a max per trade at the $10 minimum",
      limits: picker({ maxPerTrade: usdc(10) }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "a max per trade a unit under $10",
      limits: picker({ maxPerTrade: usdc(9.999999) }),
      template: "stockPicker",
      expected: [["maxPerTrade", "Pick $10 to $1,000."]]
    },
    {
      name: "a max per trade at the $1,000 maximum",
      limits: picker({ dailyBudget: usdc(2000), maxPerTrade: usdc(1000) }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "a max per trade a unit over $1,000",
      limits: picker({ dailyBudget: usdc(2000), maxPerTrade: usdc(1000.000001) }),
      template: "stockPicker",
      expected: [["maxPerTrade", "Pick $10 to $1,000."]]
    },
    {
      name: "a max per trade equal to the daily budget",
      limits: picker({ maxPerTrade: usdc(250) }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "a max per trade a unit over the daily budget",
      limits: picker({ maxPerTrade: usdc(250.000001) }),
      template: "stockPicker",
      expected: [["maxPerTrade", "Can't be more than the daily budget ($250)."]]
    },
    {
      name: "ask-me at $0 (ask every time)",
      limits: picker({ askAbove: usdc(0) }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "ask-me at the $1,000 maximum",
      limits: picker({ askAbove: usdc(1000) }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "ask-me a unit over $1,000",
      limits: picker({ askAbove: usdc(1000.000001) }),
      template: "stockPicker",
      expected: [["askAbove", "Pick $0 to $1,000."]]
    },
    {
      name: "max in one stock at the 5% minimum",
      limits: picker({ maxInOneStock: 500 }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "max in one stock a basis point under 5%",
      limits: picker({ maxInOneStock: 499 }),
      template: "stockPicker",
      expected: [["maxInOneStock", "Pick 5% to 100%."]]
    },
    {
      name: "max in one stock at 100%, with no cash reserve",
      limits: picker({ maxInOneStock: 10_000, cashReserve: 0 }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "max in one stock a basis point over 100%",
      limits: picker({ maxInOneStock: 10_001, cashReserve: 0 }),
      template: "stockPicker",
      expected: [["maxInOneStock", "Pick 5% to 100%."], [
        "cashReserve",
        "Cash reserve plus max in one stock can't pass 100%."
      ]]
    },
    {
      name: "a cash reserve a basis point under 0%",
      limits: picker({ cashReserve: -1 }),
      template: "stockPicker",
      expected: [["cashReserve", "Pick 0% to 50%."]]
    },
    {
      name: "a cash reserve at the 50% maximum",
      limits: picker({ maxInOneStock: 5000, cashReserve: 5000 }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "a cash reserve a basis point over 50%",
      limits: picker({ cashReserve: 5001 }),
      template: "stockPicker",
      expected: [["cashReserve", "Pick 0% to 50%."]]
    },
    {
      name: "max in one stock plus cash reserve at 100%",
      limits: picker({ maxInOneStock: 6000, cashReserve: 4000 }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "max in one stock plus cash reserve a basis point over 100%",
      limits: picker({ maxInOneStock: 6000, cashReserve: 4001 }),
      template: "stockPicker",
      expected: [["cashReserve", "Cash reserve plus max in one stock can't pass 100%."]]
    },
    {
      name: "one trade a day",
      limits: picker({ tradesPerDay: 1 }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "no trades a day",
      limits: picker({ tradesPerDay: 0 }),
      template: "stockPicker",
      expected: [["tradesPerDay", "Pick 1 to 48 trades a day."]]
    },
    {
      name: "48 trades a day",
      limits: picker({ tradesPerDay: 48 }),
      template: "stockPicker",
      expected: []
    },
    {
      name: "49 trades a day",
      limits: picker({ tradesPerDay: 49 }),
      template: "stockPicker",
      expected: [["tradesPerDay", "Pick 1 to 48 trades a day."]]
    },
    {
      name: "a Rebalancer trading while prices are paused",
      limits: rebalancer({ tradeWhilePaused: true }),
      template: "rebalancer",
      expected: [["tradeWhilePaused", "A Rebalancer only trades while prices are live."]]
    },
    {
      name: "a Stock picker with a target mix",
      limits: picker({ targets: REBALANCER.targets }),
      template: "stockPicker",
      expected: [["targets", "Only a Rebalancer has a target mix."]]
    },
    { name: "a balanced Rebalancer", limits: REBALANCER, template: "rebalancer", expected: [] },
    {
      name: "a Rebalancer with no target mix",
      limits: rebalancer({ targets: [] }),
      template: "rebalancer",
      expected: [["targets", "Set a target mix."]]
    },
    {
      name: "a mix naming a stock twice",
      limits: rebalancer({ targets: mix(["NVDA", 3000], ["NVDA", 3000], ["AAPL", 4000]) }),
      template: "rebalancer",
      expected: [["targets", "Each stock can appear once in the mix."]]
    },
    {
      name: "a mix missing one of the agent's stocks",
      limits: rebalancer({ targets: mix(["NVDA", 6000], ["USDC", 4000]) }),
      template: "rebalancer",
      expected: [["targets", "Give every stock a target."]]
    },
    {
      name: "a mix with a stock the agent doesn't trade",
      limits: rebalancer({ targets: mix(["NVDA", 3000], ["AAPL", 3000], ["TSLA", 1000], ["USDC", 3000]) }),
      template: "rebalancer",
      expected: [["targets", "The mix can only hold the stocks this agent trades, and cash."]]
    },
    {
      name: "a mix with a negative target",
      limits: rebalancer({ targets: mix(["NVDA", 3000], ["AAPL", -1000], ["USDC", 8000]) }),
      template: "rebalancer",
      expected: [["targets", "Targets can't be negative."]]
    },
    {
      name: "a mix a basis point short of 100%",
      limits: rebalancer({ targets: mix(["NVDA", 3000], ["AAPL", 3000], ["USDC", 3999]) }),
      template: "rebalancer",
      expected: [["targets", "The mix has to add up to 100%."]]
    },
    {
      name: "a stock's target a basis point over max in one stock",
      limits: rebalancer({ targets: mix(["NVDA", 3001], ["AAPL", 3000], ["USDC", 3999]) }),
      template: "rebalancer",
      expected: [["targets", "No stock's target can pass the max in one stock (30%)."]]
    },
    {
      name: "cash's target at the cash reserve",
      limits: rebalancer({ maxInOneStock: 5000, targets: mix(["NVDA", 4500], ["AAPL", 4500], ["USDC", 1000]) }),
      template: "rebalancer",
      expected: []
    },
    {
      name: "cash's target a basis point under the cash reserve",
      limits: rebalancer({ maxInOneStock: 5000, targets: mix(["NVDA", 4500], ["AAPL", 4501], ["USDC", 999]) }),
      template: "rebalancer",
      expected: [["targets", "Cash's target can't be under the cash reserve (10%)."]]
    },
    {
      name: "a mix with no cash target, under the cash reserve",
      limits: rebalancer({ maxInOneStock: 5000, targets: mix(["NVDA", 5000], ["AAPL", 5000]) }),
      template: "rebalancer",
      expected: [["targets", "Cash's target can't be under the cash reserve (10%)."]]
    },
    {
      name: "several problems, each reported",
      limits: picker({ mode: "buy", stocks: [], tradesPerDay: 0 }),
      template: "stockPicker",
      expected: [
        ["mode", "This agent can't trade that way."],
        ["stocks", "Pick at least one stock."],
        ["tradesPerDay", "Pick 1 to 48 trades a day."]
      ]
    }
  ])("$name", ({ expected, limits, template }) => {
    assert.deepStrictEqual(
      validate(limits, template),
      expected.map(([field, message]) => new LimitProblem({ field, message }))
    )
  })
})

describe("compare", () => {
  const SAME: Readonly<Record<LimitField, LimitChange>> = {
    stocks: "same",
    mode: "same",
    targets: "same",
    tradeWhilePaused: "same",
    dailyBudget: "same",
    maxPerTrade: "same",
    askAbove: "same",
    maxInOneStock: "same",
    cashReserve: "same",
    tradesPerDay: "same",
    priceProtection: "same",
    weeklySlippage: "same",
    rebalanceTrigger: "same"
  }

  it.each<{ name: string; before: Limits; after: Limits; overall: LimitChange; fields: Partial<typeof SAME> }>([
    { name: "no change", before: PICKER, after: picker({}), overall: "same", fields: {} },
    {
      name: "a lower daily budget is tighter",
      before: PICKER,
      after: picker({ dailyBudget: usdc(100) }),
      overall: "tighter",
      fields: { dailyBudget: "tighter" }
    },
    {
      name: "a higher daily budget is looser",
      before: PICKER,
      after: picker({ dailyBudget: usdc(300) }),
      overall: "looser",
      fields: { dailyBudget: "looser" }
    },
    {
      name: "a lower max per trade is tighter",
      before: PICKER,
      after: picker({ maxPerTrade: usdc(50) }),
      overall: "tighter",
      fields: { maxPerTrade: "tighter" }
    },
    {
      name: "a lower ask-me is tighter",
      before: PICKER,
      after: picker({ askAbove: usdc(50) }),
      overall: "tighter",
      fields: { askAbove: "tighter" }
    },
    {
      name: "a lower max in one stock is tighter",
      before: PICKER,
      after: picker({ maxInOneStock: 2000 }),
      overall: "tighter",
      fields: { maxInOneStock: "tighter" }
    },
    {
      name: "a higher cash reserve is tighter",
      before: PICKER,
      after: picker({ cashReserve: 2000 }),
      overall: "tighter",
      fields: { cashReserve: "tighter" }
    },
    {
      name: "a lower cash reserve is looser",
      before: PICKER,
      after: picker({ cashReserve: 500 }),
      overall: "looser",
      fields: { cashReserve: "looser" }
    },
    {
      name: "fewer trades a day is tighter",
      before: PICKER,
      after: picker({ tradesPerDay: 6 }),
      overall: "tighter",
      fields: { tradesPerDay: "tighter" }
    },
    {
      name: "stricter price protection is tighter",
      before: PICKER,
      after: picker({ priceProtection: 50 }),
      overall: "tighter",
      fields: { priceProtection: "tighter" }
    },
    {
      name: "a smaller weekly slippage budget is tighter",
      before: PICKER,
      after: picker({ weeklySlippage: 50 }),
      overall: "tighter",
      fields: { weeklySlippage: "tighter" }
    },
    {
      name: "a higher rebalance trigger is tighter",
      before: REBALANCER,
      after: rebalancer({ rebalanceTrigger: 1000 }),
      overall: "tighter",
      fields: { rebalanceTrigger: "tighter" }
    },
    {
      name: "a lower rebalance trigger is looser",
      before: REBALANCER,
      after: rebalancer({ rebalanceTrigger: 300 }),
      overall: "looser",
      fields: { rebalanceTrigger: "looser" }
    },
    {
      name: "a stock removed is tighter",
      before: PICKER,
      after: picker({ stocks: ["NVDA"] }),
      overall: "tighter",
      fields: { stocks: "tighter" }
    },
    {
      name: "a stock added is looser",
      before: PICKER,
      after: picker({ stocks: ["NVDA", "AAPL", "TSLA"] }),
      overall: "looser",
      fields: { stocks: "looser" }
    },
    {
      name: "a stock swapped for another is looser",
      before: PICKER,
      after: picker({ stocks: ["NVDA", "TSLA"] }),
      overall: "looser",
      fields: { stocks: "looser" }
    },
    {
      name: "the same stocks in another order are the same",
      before: PICKER,
      after: picker({ stocks: ["AAPL", "NVDA"] }),
      overall: "same",
      fields: {}
    },
    {
      name: "a new mode is looser",
      before: PICKER,
      after: picker({ mode: "buy" }),
      overall: "looser",
      fields: { mode: "looser" }
    },
    {
      name: "trading while paused turned off is tighter",
      before: PICKER,
      after: picker({ tradeWhilePaused: false }),
      overall: "tighter",
      fields: { tradeWhilePaused: "tighter" }
    },
    {
      name: "trading while paused turned on is looser",
      before: rebalancer({}),
      after: rebalancer({ tradeWhilePaused: true }),
      overall: "looser",
      fields: { tradeWhilePaused: "looser" }
    },
    {
      name: "a new target mix is looser, even toward cash",
      before: REBALANCER,
      after: rebalancer({ targets: mix(["NVDA", 2500], ["AAPL", 2500], ["USDC", 5000]) }),
      overall: "looser",
      fields: { targets: "looser" }
    },
    {
      name: "the same target mix in another order is the same",
      before: REBALANCER,
      after: rebalancer({ targets: mix(["USDC", 4000], ["AAPL", 3000], ["NVDA", 3000]) }),
      overall: "same",
      fields: {}
    },
    {
      name: "a target dropped from the mix is looser",
      before: REBALANCER,
      after: rebalancer({ targets: mix(["NVDA", 3000], ["AAPL", 3000]) }),
      overall: "looser",
      fields: { targets: "looser" }
    },
    {
      name: "one field tighter and one looser is looser",
      before: PICKER,
      after: picker({ dailyBudget: usdc(100), stocks: ["NVDA", "AAPL", "TSLA"] }),
      overall: "looser",
      fields: { dailyBudget: "tighter", stocks: "looser" }
    }
  ])("$name", ({ after, before, fields, overall }) => {
    assert.deepStrictEqual(compare(before, after), { overall, fields: { ...SAME, ...fields } })
  })
})

describe("describe", () => {
  const NAMES: Readonly<Record<string, string>> = { NVDA: "NVIDIA", AAPL: "Apple", TSLA: "Tesla", MSFT: "Microsoft" }
  const name = (symbol: StockSymbol) => NAMES[symbol] ?? symbol

  const PICKER_DESCRIPTION: Description = {
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
  }
  const withTrade = (trade: string): Description => ({
    ...PICKER_DESCRIPTION,
    can: [trade, ...PICKER_DESCRIPTION.can.slice(1)]
  })

  it.each<{ name: string; limits: Limits; expected: Description }>([
    { name: "a balanced Stock picker", limits: PICKER, expected: PICKER_DESCRIPTION },
    {
      name: "a balanced Rebalancer",
      limits: REBALANCER,
      expected: {
        can: [
          "Trade NVIDIA and Apple, only to move you back to your target mix",
          "Spend up to $250 a day",
          "Trade up to $100 at a time, 6 times a day at most",
          "Ask you before trades over $150"
        ],
        never: [
          "Send money out of your account",
          "Put over 30% of your money in one stock",
          "Leave less than 10% in cash",
          "Trade more than 1% away from Chainlink's price",
          "Lose more than 1% of your money to prices in a week",
          "Trade while prices are paused",
          "Change its own limits"
        ]
      }
    },
    {
      name: "a buy-only agent",
      limits: picker({ mode: "buy" }),
      expected: withTrade("Buy NVIDIA and Apple")
    },
    {
      name: "a sell-only agent with no budget",
      limits: picker({ mode: "sell", dailyBudget: usdc(0) }),
      expected: {
        ...PICKER_DESCRIPTION,
        can: [
          "Sell NVIDIA and Apple",
          "Trade up to $100 at a time, 12 times a day at most",
          "Ask you before trades over $150",
          "Trade on weekends and holidays, with a tighter price limit"
        ]
      }
    },
    {
      name: "one stock",
      limits: picker({ stocks: ["NVDA"] }),
      expected: withTrade("Buy and sell NVIDIA")
    },
    {
      name: "three stocks",
      limits: picker({ stocks: ["NVDA", "AAPL", "TSLA"] }),
      expected: withTrade("Buy and sell NVIDIA, Apple and Tesla")
    },
    {
      name: "four stocks",
      limits: picker({ stocks: ["NVDA", "AAPL", "TSLA", "MSFT"] }),
      expected: withTrade("Buy and sell NVIDIA, Apple, Tesla and 1 more")
    },
    {
      name: "no stocks",
      limits: picker({ stocks: [] }),
      expected: withTrade("Buy and sell no stocks")
    },
    {
      name: "ask-me at $0",
      limits: picker({ askAbove: usdc(0) }),
      expected: {
        ...PICKER_DESCRIPTION,
        can: [
          "Buy and sell NVIDIA and Apple",
          "Spend up to $250 a day",
          "Trade up to $100 at a time, 12 times a day at most",
          "Ask you before every trade",
          "Trade on weekends and holidays, with a tighter price limit"
        ]
      }
    },
    {
      name: "100% in one stock and no cash reserve",
      limits: picker({ maxInOneStock: 10_000, cashReserve: 0 }),
      expected: {
        ...PICKER_DESCRIPTION,
        never: [
          "Send money out of your account",
          "Trade more than 1% away from Chainlink's price",
          "Lose more than 1% of your money to prices in a week",
          "Change its own limits"
        ]
      }
    },
    {
      name: "fractional percents",
      limits: picker({ maxInOneStock: 2550, cashReserve: 1250, priceProtection: 50, weeklySlippage: 200 }),
      expected: {
        ...PICKER_DESCRIPTION,
        never: [
          "Send money out of your account",
          "Put over 25.5% of your money in one stock",
          "Leave less than 12.5% in cash",
          "Trade more than 0.5% away from Chainlink's price",
          "Lose more than 2% of your money to prices in a week",
          "Change its own limits"
        ]
      }
    },
    {
      name: "dollars round down to the dollar",
      limits: picker({ dailyBudget: usdc(250.99), maxPerTrade: usdc(1000.5), askAbove: usdc(150.75) }),
      expected: {
        ...PICKER_DESCRIPTION,
        can: [
          "Buy and sell NVIDIA and Apple",
          "Spend up to $250 a day",
          "Trade up to $1,000 at a time, 12 times a day at most",
          "Ask you before trades over $150",
          "Trade on weekends and holidays, with a tighter price limit"
        ]
      }
    }
  ])("$name", ({ expected, limits }) => {
    assert.deepStrictEqual(describeLimits(limits, name), expected)
  })
})
