import { type RunOutcome, runResultOf } from "@bluechip/domain/automations/Run"
import type { Decision, IntentStatus } from "@bluechip/domain/intents/Intent"
import { assert, describe, it } from "@effect/vitest"

const OVER_TRADE_SIZE: Decision = {
  _tag: "Refused",
  policy: "tradeSize",
  error: null,
  stock: null,
  message: "Over its trade size."
}
const UNDER_CASH_RESERVE: Decision = {
  _tag: "Refused",
  policy: "cashReserve",
  error: null,
  stock: null,
  message: "Under its cash reserve."
}

describe("runResultOf", () => {
  it.each<{
    name: string
    outcome: RunOutcome
    trades: ReadonlyArray<{ readonly status: IntentStatus; readonly decision: Decision | null }>
    expected: ReturnType<typeof runResultOf>
  }>([
    {
      name: "every trade filled",
      outcome: "proposed",
      trades: [{ status: "filled", decision: null }, { status: "filled", decision: null }],
      expected: { result: "traded", blockedBy: [] }
    },
    {
      name: "every trade blocked, by one policy",
      outcome: "proposed",
      trades: [
        { status: "blocked", decision: OVER_TRADE_SIZE },
        { status: "blocked", decision: OVER_TRADE_SIZE }
      ],
      expected: { result: "blocked", blockedBy: ["tradeSize"] }
    },
    {
      name: "one filled, one blocked",
      outcome: "proposed",
      trades: [{ status: "filled", decision: null }, { status: "blocked", decision: UNDER_CASH_RESERVE }],
      expected: { result: "partlyTraded", blockedBy: ["cashReserve"] }
    },
    {
      name: "one filled, one failed onchain",
      outcome: "proposed",
      trades: [{ status: "filled", decision: null }, { status: "failed", decision: null }],
      expected: { result: "partlyTraded", blockedBy: [] }
    },
    {
      name: "one blocked, one declined: nothing filled, a policy blocked",
      outcome: "proposed",
      trades: [{ status: "blocked", decision: OVER_TRADE_SIZE }, { status: "declined", decision: null }],
      expected: { result: "blocked", blockedBy: ["tradeSize"] }
    },
    {
      name: "every trade expired",
      outcome: "asked",
      trades: [{ status: "expired", decision: null }],
      expected: { result: "notTraded", blockedBy: [] }
    },
    {
      name: "one filled, one still sending",
      outcome: "proposed",
      trades: [{ status: "filled", decision: null }, { status: "sending", decision: null }],
      expected: { result: "working", blockedBy: [] }
    },
    {
      name: "a trade waiting for prices",
      outcome: "proposed",
      trades: [{ status: "waiting", decision: null }],
      expected: { result: "working", blockedBy: [] }
    },
    {
      name: "a trade over the largest, waiting for your approval",
      outcome: "proposed",
      trades: [{ status: "filled", decision: null }, { status: "needsApproval", decision: null }],
      expected: { result: "asked", blockedBy: [] }
    },
    {
      name: "asked, its trades not prepared yet",
      outcome: "asked",
      trades: [{ status: "proposed", decision: null }],
      expected: { result: "asked", blockedBy: [] }
    },
    {
      name: "asked, then approved and filled",
      outcome: "asked",
      trades: [{ status: "filled", decision: null }],
      expected: { result: "traded", blockedBy: [] }
    },
    {
      name: "proposed, its trades not found",
      outcome: "proposed",
      trades: [],
      expected: { result: "working", blockedBy: [] }
    },
    { name: "notified", outcome: "notified", trades: [], expected: { result: "notified", blockedBy: [] } },
    { name: "skipped", outcome: "skipped", trades: [], expected: { result: "skipped", blockedBy: [] } },
    { name: "failed", outcome: "failed", trades: [], expected: { result: "failed", blockedBy: [] } }
  ])("$name", ({ expected, outcome, trades }) => {
    assert.deepStrictEqual(runResultOf(outcome, trades), expected)
  })
})
