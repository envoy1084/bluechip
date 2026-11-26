import {
  asksFirst,
  type AutomationDraft,
  checkAutomation,
  describeAutomation
} from "@bluechip/domain/automations/Automation"
import { Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  draft,
  NVDA_FALLS_10,
  price,
  SELL_HALF_NVDA,
  STOP_LOSS_GUARD,
  WEEKLY_BUYER
} from "../../fixtures/Automations.ts"
import { PICKER, REBALANCER } from "../../fixtures/Specs.ts"

const NEWS_ON_CHIPS = { type: "news", config: { symbols: ["NVDA"], topics: [] } } as const

const name = (symbol: string) => ({ AAPL: "Apple", NVDA: "NVIDIA", TSLA: "Tesla" })[symbol] ?? symbol

describe("checkAutomation", () => {
  it.each<{
    name: string
    draft: AutomationDraft
    spec: AgentSpec | null
    expected: ReadonlyArray<readonly [string, number | null, string | null, string]>
  }>([
    { name: "a weekly $50 Apple buy for a Weekly buyer", draft: draft({}), spec: WEEKLY_BUYER, expected: [] },
    { name: "a weekly $50 Apple buy of your own", draft: draft({}), spec: null, expected: [] },
    {
      name: "a sale for a Weekly buyer",
      draft: draft({ trigger: NVDA_FALLS_10, action: SELL_HALF_NVDA }),
      spec: WEEKLY_BUYER,
      expected: [["action", null, null, "This agent only buys."]]
    },
    {
      name: "a buy for a Stop-loss guard",
      draft: draft({
        action: { type: "buy", config: { amount: Usdc.make(50_000_000n), split: [{ symbol: "NVDA", weight: 10_000 }] } }
      }),
      spec: STOP_LOSS_GUARD,
      expected: [["action", null, null, "This agent only sells."]]
    },
    {
      name: "a buy of a stock the agent doesn't trade",
      draft: draft({
        action: { type: "buy", config: { amount: Usdc.make(50_000_000n), split: [{ symbol: "TSLA", weight: 10_000 }] } }
      }),
      spec: WEEKLY_BUYER,
      expected: [["action", null, "split", "This agent doesn't trade TSLA."]]
    },
    {
      name: "a buy over the agent's $250 daily budget",
      draft: draft({
        action: {
          type: "buy",
          config: { amount: Usdc.make(300_000_000n), split: [{ symbol: "AAPL", weight: 10_000 }] }
        }
      }),
      spec: WEEKLY_BUYER,
      expected: [
        ["action", null, "amount", "Over the agent's daily budget ($250)."],
        ["action", null, "amount", "Takes 3 trades of at most $100, more than the agent's 1 a day."]
      ]
    },
    {
      name: "a $200 buy, two of the agent's $100 trades when it makes one a day",
      draft: draft({
        action: {
          type: "buy",
          config: { amount: Usdc.make(200_000_000n), split: [{ symbol: "AAPL", weight: 10_000 }] }
        }
      }),
      spec: WEEKLY_BUYER,
      expected: [["action", null, "amount", "Takes 2 trades of at most $100, more than the agent's 1 a day."]]
    },
    {
      name: "a $300 buy that asks you first: your Face ID isn't bound by the agent's amounts",
      draft: draft({
        action: {
          type: "ask",
          config: {
            trade: {
              type: "buy",
              config: { amount: Usdc.make(300_000_000n), split: [{ symbol: "AAPL", weight: 10_000 }] }
            }
          }
        }
      }),
      spec: WEEKLY_BUYER,
      expected: []
    },
    {
      name: "a split that adds up to 90%",
      draft: draft({
        action: {
          type: "buy",
          config: {
            amount: Usdc.make(50_000_000n),
            split: [{ symbol: "AAPL", weight: 4000 }, { symbol: "NVDA", weight: 5000 }]
          }
        }
      }),
      spec: null,
      expected: [["action", null, "split", "The split has to add up to 100%."]]
    },
    {
      name: "a split whose parts are under the agent's $5 smallest trade",
      draft: draft({
        action: {
          type: "buy",
          config: {
            amount: Usdc.make(8_000_000n),
            split: [{ symbol: "AAPL", weight: 5000 }, { symbol: "NVDA", weight: 5000 }]
          }
        }
      }),
      spec: WEEKLY_BUYER,
      expected: [
        [
          "action",
          null,
          "split",
          "Each stock's part has to be at least $5.05, so it's still $5 after the trade's costs."
        ],
        ["action", null, "amount", "Takes 2 trades of at most $100, more than the agent's 1 a day."]
      ]
    },
    {
      name: "a buy of exactly the agent's $5 smallest trade, which lands under it after its costs",
      draft: draft({
        action: { type: "buy", config: { amount: Usdc.make(5_000_000n), split: [{ symbol: "AAPL", weight: 10_000 }] } }
      }),
      spec: WEEKLY_BUYER,
      expected: [[
        "action",
        null,
        "split",
        "Each stock's part has to be at least $5.05, so it's still $5 after the trade's costs."
      ]]
    },
    {
      name: "a buy of $5.05, the agent's $5 smallest trade and its costs",
      draft: draft({
        action: { type: "buy", config: { amount: Usdc.make(5_050_000n), split: [{ symbol: "AAPL", weight: 10_000 }] } }
      }),
      spec: WEEKLY_BUYER,
      expected: []
    },
    {
      name: "$100 split across two stocks: a trade each, for an agent that makes one a day",
      draft: draft({
        action: {
          type: "buy",
          config: {
            amount: Usdc.make(100_000_000n),
            split: [{ symbol: "AAPL", weight: 5000 }, { symbol: "NVDA", weight: 5000 }]
          }
        }
      }),
      spec: WEEKLY_BUYER,
      expected: [["action", null, "amount", "Takes 2 trades of at most $100, more than the agent's 1 a day."]]
    },
    {
      name: "drift for an agent without a target mix",
      draft: draft({ trigger: { type: "drift", config: {} }, action: { type: "rebalance", config: {} } }),
      spec: PICKER,
      expected: [
        ["trigger", null, null, "Give the agent a target mix first."],
        ["action", null, null, "Only an agent with a target mix can rebalance."]
      ]
    },
    {
      name: "drift and rebalance for a Rebalancer",
      draft: draft({ trigger: { type: "drift", config: {} }, action: { type: "rebalance", config: {} } }),
      spec: REBALANCER,
      expected: []
    },
    {
      name: "drift for your own trades",
      draft: draft({
        trigger: { type: "drift", config: {} },
        action: { type: "notify", config: { message: "Your mix drifted." } }
      }),
      spec: null,
      expected: [["trigger", null, null, "Only an agent with a target mix can watch drift."]]
    },
    {
      name: "a message with nothing to say",
      draft: draft({ action: { type: "notify", config: { message: "  " } } }),
      spec: null,
      expected: [["action", null, "message", "Write what to tell you."]]
    },
    {
      name: "a judgment on a schedule",
      draft: draft({
        conditions: [{ type: "judgment", config: { preset: "materiallyNegative", minConfidenceBps: 7000 } }]
      }),
      spec: null,
      expected: [["conditions", 0, null, "A judgment reads the story that fired it: use news."]]
    },
    {
      name: "a judgment on news",
      draft: draft({
        trigger: NEWS_ON_CHIPS,
        conditions: [{ type: "judgment", config: { preset: "materiallyNegative", minConfidenceBps: 7000 } }],
        action: SELL_HALF_NVDA
      }),
      spec: STOP_LOSS_GUARD,
      expected: []
    },
    {
      name: "a price move of 0.5%, under the 1% least",
      draft: draft({ trigger: { type: "priceMove", config: { ...NVDA_FALLS_10.config, bps: 50 } as never } }),
      spec: null,
      expected: [["trigger", null, "bps", "Too small."]]
    },
    {
      name: "a price move on a stock the agent doesn't trade",
      draft: draft({ trigger: { type: "priceMove", config: { ...NVDA_FALLS_10.config, symbol: "TSLA" } as never } }),
      spec: WEEKLY_BUYER,
      expected: [["trigger", null, "symbol", "This agent doesn't trade TSLA."]]
    },
    {
      name: "a schedule in an unknown time zone",
      draft: draft({
        trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "Mars/Olympus" } }
      }),
      spec: null,
      expected: [["trigger", null, "timeZone", "Pick a time zone."]]
    },
    {
      name: "a holding level without its stock",
      draft: draft({
        trigger: { type: "portfolio", config: { measure: "holding", symbol: null, direction: "above", bps: 4000 } }
      }),
      spec: null,
      expected: [["trigger", null, "symbol", "Pick the stock to measure."]]
    },
    {
      name: "quiet hours that start and end at once",
      draft: draft({ settings: { quietHours: { from: "22:00", to: "22:00", timeZone: "UTC" } } }),
      spec: null,
      expected: [["settings", null, "quietHours", "Pick a different end for the quiet hours."]]
    },
    {
      name: "an empty all",
      draft: draft({ conditions: [{ type: "all", config: { conditions: [] } }] }),
      spec: null,
      expected: [["conditions", 0, "conditions", "Add at least one condition."]]
    }
  ])("$name", ({ draft, expected, spec }) => {
    const problems = checkAutomation(draft, spec).map((problem) =>
      [problem.part, problem.index, problem.field, problem.message] as const
    )

    assert.deepStrictEqual(problems, expected)
  })
})

describe("asksFirst", () => {
  it.each<{ name: string; draft: AutomationDraft; expected: boolean }>([
    { name: "a scheduled buy", draft: draft({}), expected: false },
    { name: "an ask", draft: draft({ action: { type: "ask", config: { trade: SELL_HALF_NVDA } } }), expected: true },
    { name: "a sale on news", draft: draft({ trigger: NEWS_ON_CHIPS, action: SELL_HALF_NVDA }), expected: true },
    {
      name: "a sale on news allowed to act directly",
      draft: draft({ trigger: NEWS_ON_CHIPS, action: SELL_HALF_NVDA, settings: { actDirectly: true } }),
      expected: false
    },
    {
      name: "a sale behind a judgment",
      draft: draft({
        trigger: NVDA_FALLS_10,
        conditions: [{ type: "judgment", config: { preset: "materiallyNegative", minConfidenceBps: 7000 } }],
        action: SELL_HALF_NVDA
      }),
      expected: true
    },
    {
      name: "a message on news",
      draft: draft({ trigger: NEWS_ON_CHIPS, action: { type: "notify", config: { message: "Read this." } } }),
      expected: false
    }
  ])("$name", ({ draft, expected }) => {
    assert.strictEqual(asksFirst(draft), expected)
  })
})

describe("describeAutomation", () => {
  it("a weekly buy", () => {
    const description = describeAutomation(draft({}), name)

    assert.deepStrictEqual({ ...description }, {
      sentence: "Every Monday at 10:00 New York time, buy $50 of Apple.",
      trigger: "every Monday at 10:00 New York time",
      conditions: [],
      action: "buy $50 of Apple",
      settings: ["At most once an hour"]
    })
  })

  it("a stop-loss on NVIDIA's high, while you still hold it", () => {
    const description = describeAutomation(
      draft({
        trigger: NVDA_FALLS_10,
        conditions: [{ type: "holdingAtLeast", config: { symbol: "NVDA", shares: 0n as never } }],
        action: SELL_HALF_NVDA
      }),
      name
    )

    assert.deepStrictEqual(
      [description.sentence, description.settings],
      [
        "When NVIDIA falls 10% from its high, if you still hold NVIDIA, sell half your NVIDIA.",
        ["At most once an hour", "Only while the market is open"]
      ]
    )
  })

  it("material bad news on chips, asking first", () => {
    const description = describeAutomation(
      draft({
        trigger: { type: "news", config: { symbols: ["NVDA", "AAPL"], topics: ["chips"] } },
        conditions: [{ type: "judgment", config: { preset: "materiallyNegative", minConfidenceBps: 7000 } }],
        action: SELL_HALF_NVDA
      }),
      name
    )

    assert.deepStrictEqual(
      [description.sentence, description.settings],
      [
        "When there is news about NVIDIA and Apple, or a story mentioning \"chips\", if the news looks materially bad, " +
        "ask you whether to sell half your NVIDIA.",
        ["At most once an hour", "Asks you before trading on news"]
      ]
    )
  })

  it("a cross above $250, split evenly, up to 3 times until 1 Feb", () => {
    const description = describeAutomation(
      draft({
        trigger: { type: "priceCross", config: { symbol: "AAPL", level: price(250), direction: "above" } },
        action: {
          type: "buy",
          config: {
            amount: Usdc.make(100_000_000n),
            split: [{ symbol: "AAPL", weight: 5000 }, { symbol: "NVDA", weight: 5000 }]
          }
        },
        settings: { maxFires: 3, expiresAt: DateTime.makeUnsafe("2027-02-01T00:00:00Z"), cooldownMinutes: 24 * 60 }
      }),
      name
    )

    assert.deepStrictEqual(
      [description.sentence, description.settings],
      [
        "When Apple goes above $250, buy $100 split across Apple and NVIDIA.",
        ["At most once a day", "Up to 3 times", "Until 1 Feb 2027", "Only while the market is open"]
      ]
    )
  })
})
