import type { Card } from "@bluechip/domain/assistant/Card"
import { CardId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import { type MixShift, mixShifts, planLegs } from "../../../../../src/features/assistant/model/rebalancePlan.ts"
import { buyOf, holdingOf, legIntent, portfolioOf, sellOf } from "../../../../fixtures/Results.ts"

// $1,000: $500 of Nvidia at $100 a share, $300 of Apple at $150, $200 cash.
const PORTFOLIO = portfolioOf(200, [holdingOf("NVDA", 500, 100), holdingOf("AAPL", 300, 150)])

describe("mixShifts", () => {
  it.each<{ name: string; legs: ReadonlyArray<ReturnType<typeof legIntent>>; expected: ReadonlyArray<MixShift> }>([
    {
      name: "a sale and a buy move value between stocks, cash where it was",
      legs: [legIntent(1, sellOf("NVDA", 1)), legIntent(2, buyOf("AAPL", 100))],
      expected: [
        { id: "NVDA", before: 50, after: 40 },
        { id: "AAPL", before: 30, after: 40 },
        { id: "cash", before: 20, after: 20 }
      ]
    },
    {
      name: "a new stock comes after the ones held, before cash",
      legs: [legIntent(1, buyOf("MSFT", 100))],
      expected: [
        { id: "NVDA", before: 50, after: 50 },
        { id: "AAPL", before: 30, after: 30 },
        { id: "MSFT", before: 0, after: 10 },
        { id: "cash", before: 20, after: 10 }
      ]
    },
    {
      name: "a sale of a stock without a price moves nothing",
      legs: [legIntent(1, sellOf("TSLA", 2))],
      expected: [
        { id: "NVDA", before: 50, after: 50 },
        { id: "AAPL", before: 30, after: 30 },
        { id: "TSLA", before: 0, after: 0 },
        { id: "cash", before: 20, after: 20 }
      ]
    },
    {
      name: "a buy over the cash leaves none, never less",
      legs: [legIntent(1, buyOf("NVDA", 300))],
      expected: [
        { id: "NVDA", before: 50, after: 80 },
        { id: "AAPL", before: 30, after: 30 },
        { id: "cash", before: 20, after: 0 }
      ]
    },
    {
      name: "no trades",
      legs: [],
      expected: [
        { id: "NVDA", before: 50, after: 50 },
        { id: "AAPL", before: 30, after: 30 },
        { id: "cash", before: 20, after: 20 }
      ]
    }
  ])("$name", ({ expected, legs }) => {
    assert.deepStrictEqual(mixShifts(PORTFOLIO, legs), expected)
  })

  it("an empty portfolio has no mix", () => {
    assert.strictEqual(mixShifts(portfolioOf(0, []), [legIntent(1, buyOf("NVDA", 50))]), null)
  })
})

describe("planLegs", () => {
  it("the trades of the plan's cards, in order; other cards left out", () => {
    const first = legIntent(1, buyOf("AAPL", 50))
    const second = legIntent(2, sellOf("NVDA", 1))
    const cards: ReadonlyArray<Card> = [
      { _tag: "Trade", id: CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v31"), intent: first },
      { _tag: "Error", id: CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v32"), reason: "budget", message: "Out." },
      { _tag: "Trade", id: CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v33"), intent: second }
    ]

    assert.deepStrictEqual(planLegs(cards), [first, second])
  })
})
