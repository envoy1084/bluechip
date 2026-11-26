import { assert, describe, it } from "@effect/vitest"
import {
  actorLine,
  type BriefActor,
  dailyBrief,
  isQuietDay
} from "../../../../../src/features/assistant/model/dailyBrief.ts"
import { appleTrade, cashTransfer } from "../../../../fixtures/Activity.ts"
import { AGENT_ID } from "../../../../fixtures/Agents.ts"
import { buyOf, holdingOf, legIntent, portfolioOf, usd } from "../../../../fixtures/Results.ts"

// $1,000 read at 15:00 UTC on 26 Nov, up $40 since the previous close (from $960).
const PORTFOLIO = portfolioOf(200, [holdingOf("NVDA", 800, 100)], 40)

// The fixture trade is at 09:41 on 26 Nov: inside the day before 15:00 that day.
const IN_THE_DAY = appleTrade()

describe("dailyBrief", () => {
  it("the value, its move, what each actor traded in the day, and what waits for you", () => {
    const waiting = legIntent(1, buyOf("NVDA", 400), "needsApproval")
    assert.deepStrictEqual(
      dailyBrief(
        PORTFOLIO,
        [
          IN_THE_DAY,
          appleTrade({ agentId: AGENT_ID }),
          appleTrade({ agentId: AGENT_ID, side: "sell" }),
          cashTransfer()
        ],
        [waiting]
      ),
      {
        value: usd(1000),
        change: usd(40),
        changePercent: 4.16,
        actors: [
          { agentId: null, bought: 1, sold: 0, spent: usd(92.95), got: usd(0), failed: 0 },
          { agentId: AGENT_ID, bought: 1, sold: 1, spent: usd(92.95), got: usd(92.95), failed: 0 }
        ],
        transfers: 1,
        waiting: [waiting]
      }
    )
  })

  it("a trade that didn't go through is counted as such, not as a buy", () => {
    assert.deepStrictEqual(
      dailyBrief(PORTFOLIO, [appleTrade({ status: "failed" })], []).actors,
      [{ agentId: null, bought: 0, sold: 0, spent: usd(0), got: usd(0), failed: 1 }]
    )
  })

  it.each([
    { name: "a trade just inside the day before it was read", asOf: "2026-11-27T09:40:00Z", expected: 1 },
    { name: "a trade a day and a minute before", asOf: "2026-11-27T09:42:00Z", expected: 0 },
    { name: "a trade after it was read", asOf: "2026-11-26T09:40:00Z", expected: 0 }
  ])("$name", ({ asOf, expected }) => {
    const portfolio = portfolioOf(200, [holdingOf("NVDA", 800, 100)], 40, asOf)
    assert.strictEqual(dailyBrief(portfolio, [IN_THE_DAY], []).actors.length, expected)
  })

  it("only trades waiting for you, each once", () => {
    const waiting = legIntent(1, buyOf("NVDA", 400), "awaitingSignature")
    const sent = legIntent(2, buyOf("NVDA", 50), "filled")
    assert.deepStrictEqual(dailyBrief(PORTFOLIO, [], [waiting, sent, waiting]).waiting, [waiting])
  })

  it("an empty account moved 0%", () => {
    assert.strictEqual(dailyBrief(portfolioOf(0, []), [], []).changePercent, 0)
  })
})

describe("isQuietDay", () => {
  it.each([
    { name: "nothing traded, moved or waiting", activity: [], waiting: false, expected: true },
    { name: "a trade", activity: [IN_THE_DAY], waiting: false, expected: false },
    { name: "a transfer", activity: [cashTransfer()], waiting: false, expected: false },
    { name: "a trade waiting for you", activity: [], waiting: true, expected: false }
  ])("$name", ({ activity, expected, waiting }) => {
    const brief = dailyBrief(PORTFOLIO, activity, waiting ? [legIntent(1, buyOf("NVDA", 400), "needsApproval")] : [])
    assert.strictEqual(isQuietDay(brief), expected)
  })
})

describe("actorLine", () => {
  const none: BriefActor = { agentId: null, bought: 0, sold: 0, spent: usd(0), got: usd(0), failed: 0 }
  it.each<{ name: string; actor: BriefActor; expected: string }>([
    { name: "one buy", actor: { ...none, bought: 1, spent: usd(50) }, expected: "1 buy for $50.00" },
    {
      name: "buys and a sale",
      actor: { ...none, bought: 2, spent: usd(100), sold: 1, got: usd(40) },
      expected: "2 buys for $100.00 and 1 sale for $40.00"
    },
    {
      name: "all three",
      actor: { ...none, bought: 2, spent: usd(100), sold: 2, got: usd(40), failed: 1 },
      expected: "2 buys for $100.00, 2 sales for $40.00 and 1 trade didn't go through"
    },
    { name: "only failures", actor: { ...none, failed: 2 }, expected: "2 trades didn't go through" }
  ])("$name", ({ actor, expected }) => {
    assert.strictEqual(actorLine(actor), expected)
  })
})
