import { journalOfIntent, journalOfJudgment, journalOfRun } from "@bluechip/domain/journal/Journal"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

const LEG = { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(50_000_000n) } } as const

describe("journalOfIntent", () => {
  it.each(
    [
      { status: "proposed", decision: null, expected: undefined },
      { status: "deciding", decision: null, expected: undefined },
      { status: "confirming", decision: null, expected: undefined },
      {
        status: "sending",
        decision: { _tag: "Passes", callGasLimit: 1n },
        expected: "Buy $50.00 of NVIDIA, sent within its policies. Why: Dip."
      },
      {
        status: "needsApproval",
        decision: { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(25_000_000n) },
        expected: "Buy $50.00 of NVIDIA. Over the agent's largest trade ($25): it needs your Face ID. Why: Dip."
      },
      {
        status: "waiting",
        decision: { _tag: "Wait", reason: "noGas" },
        expected: "Buy $50.00 of NVIDIA. Waiting: your account needs a little ETH for gas. Why: Dip."
      },
      {
        status: "blocked",
        decision: {
          _tag: "Refused",
          policy: "trade",
          error: "StockNotAllowed",
          stock: "NVDA",
          message: "Not this one."
        },
        expected: "Buy $50.00 of NVIDIA, blocked by Stocks and direction: Not this one. Why: Dip."
      },
      {
        status: "awaitingSignature",
        decision: null,
        expected: "Buy $50.00 of NVIDIA: you approved it, and it waits for your Face ID."
      },
      { status: "filled", decision: null, expected: "Buy $50.00 of NVIDIA: filled." },
      { status: "failed", decision: null, expected: "Buy $50.00 of NVIDIA: failed onchain, nothing was traded." },
      { status: "declined", decision: null, expected: "Buy $50.00 of NVIDIA: you declined it." },
      { status: "expired", decision: null, expected: "Buy $50.00 of NVIDIA: expired before it was answered." },
      { status: "cancelled", decision: null, expected: "Buy $50.00 of NVIDIA: cancelled before it was sent." }
    ] as const
  )("$status", ({ decision, expected, status }) => {
    const entry = journalOfIntent({ status, leg: LEG, reason: "Dip.", decision } as never, () => "NVIDIA")

    assert.strictEqual(entry, expected)
  })
})

describe("journalOfRun", () => {
  it("names the automation, what it did and why", () => {
    assert.strictEqual(
      journalOfRun({ automationName: "Buy the dip", outcome: "skipped", reason: "NVIDIA didn't fall 5%." }),
      "Automation \"Buy the dip\" skipped: NVIDIA didn't fall 5%."
    )
  })
})

describe("journalOfJudgment", () => {
  it("says the headline, the answer, how sure and why", () => {
    assert.strictEqual(
      journalOfJudgment({
        automationName: "Sell on bad news",
        headline: "NVIDIA misses estimates",
        answer: { verdict: true, confidence: 0.82, reason: "A miss is materially negative." }
      }),
      "Automation \"Sell on bad news\" judged \"NVIDIA misses estimates\": yes, 82% sure. A miss is materially negative."
    )
  })
})
