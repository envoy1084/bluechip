import { describeDecision, describeLeg } from "@bluechip/domain/intents/Describe"
import {
  type Decision,
  type IntentEvent,
  type IntentStatus,
  isEnded,
  transition
} from "@bluechip/domain/intents/Intent"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Result from "effect/Result"

const PASSES: Decision = { _tag: "Passes", callGasLimit: 1_400_000n }
const OVER: Decision = { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(100_000_000n) }
const REFUSED: Decision = {
  _tag: "Refused",
  policy: "stockCap",
  error: "OverStockCap",
  stock: "NVDA",
  message: "Would put too much of your money in NVDA."
}
const WAIT: Decision = { _tag: "Wait", reason: "pricesPaused", until: DateTime.makeUnsafe("2026-11-30T14:30:00Z") }

describe("transition", () => {
  it.each<{ name: string; status: IntentStatus; event: IntentEvent; expected: Result.Result<IntentStatus, string> }>([
    {
      name: "proposed, decide: deciding",
      status: "proposed",
      event: { _tag: "Decide" },
      expected: Result.succeed("deciding")
    },
    {
      name: "waiting, decide again: deciding",
      status: "waiting",
      event: { _tag: "Decide" },
      expected: Result.succeed("deciding")
    },
    {
      name: "filled, decide again",
      status: "filled",
      event: { _tag: "Decide" },
      expected: Result.fail("a filled intent can't be decided")
    },
    {
      name: "deciding, passes: sending",
      status: "deciding",
      event: { _tag: "Decided", decision: PASSES },
      expected: Result.succeed("sending")
    },
    {
      name: "deciding, over the largest trade: needsApproval",
      status: "deciding",
      event: { _tag: "Decided", decision: OVER },
      expected: Result.succeed("needsApproval")
    },
    {
      name: "deciding, asking you first: needsApproval",
      status: "deciding",
      event: { _tag: "Decided", decision: { _tag: "Ask" } },
      expected: Result.succeed("needsApproval")
    },
    {
      name: "deciding, refused: blocked",
      status: "deciding",
      event: { _tag: "Decided", decision: REFUSED },
      expected: Result.succeed("blocked")
    },
    {
      name: "deciding, wait: waiting",
      status: "deciding",
      event: { _tag: "Decided", decision: WAIT },
      expected: Result.succeed("waiting")
    },
    {
      name: "proposed, decided without deciding",
      status: "proposed",
      event: { _tag: "Decided", decision: PASSES },
      expected: Result.fail("a proposed intent can't take a decision")
    },
    {
      name: "proposed (your own), prepared: awaitingSignature",
      status: "proposed",
      event: { _tag: "Prepared" },
      expected: Result.succeed("awaitingSignature")
    },
    {
      name: "needsApproval, approved and prepared: awaitingSignature",
      status: "needsApproval",
      event: { _tag: "Prepared" },
      expected: Result.succeed("awaitingSignature")
    },
    {
      name: "blocked, prepared",
      status: "blocked",
      event: { _tag: "Prepared" },
      expected: Result.fail("a blocked intent can't wait for a signature")
    },
    {
      name: "awaitingSignature, signed: sending",
      status: "awaitingSignature",
      event: { _tag: "Signed" },
      expected: Result.succeed("sending")
    },
    {
      name: "sending, accepted: confirming",
      status: "sending",
      event: { _tag: "Accepted" },
      expected: Result.succeed("confirming")
    },
    { name: "confirming, filled", status: "confirming", event: { _tag: "Filled" }, expected: Result.succeed("filled") },
    { name: "sending, failed", status: "sending", event: { _tag: "Failed" }, expected: Result.succeed("failed") },
    { name: "confirming, failed", status: "confirming", event: { _tag: "Failed" }, expected: Result.succeed("failed") },
    {
      name: "filled, failed",
      status: "filled",
      event: { _tag: "Failed" },
      expected: Result.fail("a filled intent can't fail")
    },
    {
      name: "needsApproval, declined",
      status: "needsApproval",
      event: { _tag: "Declined" },
      expected: Result.succeed("declined")
    },
    {
      name: "waiting, declined",
      status: "waiting",
      event: { _tag: "Declined" },
      expected: Result.fail("a waiting intent can't be declined")
    },
    { name: "waiting, expired", status: "waiting", event: { _tag: "Expired" }, expected: Result.succeed("expired") },
    {
      name: "awaitingSignature, expired",
      status: "awaitingSignature",
      event: { _tag: "Expired" },
      expected: Result.succeed("expired")
    },
    {
      name: "sending, expired",
      status: "sending",
      event: { _tag: "Expired" },
      expected: Result.fail("a sending intent can't expire")
    },
    {
      name: "needsApproval, cancelled",
      status: "needsApproval",
      event: { _tag: "Cancelled" },
      expected: Result.succeed("cancelled")
    },
    {
      name: "confirming, cancelled",
      status: "confirming",
      event: { _tag: "Cancelled" },
      expected: Result.fail("a confirming intent can't be cancelled")
    }
  ])("$name", ({ event, expected, status }) => {
    assert.deepStrictEqual(transition(status, event), expected)
  })
})

describe("isEnded", () => {
  it.each<{ status: IntentStatus; expected: boolean }>([
    { status: "filled", expected: true },
    { status: "blocked", expected: true },
    { status: "cancelled", expected: true },
    { status: "waiting", expected: false },
    { status: "needsApproval", expected: false },
    { status: "confirming", expected: false }
  ])("$status: $expected", ({ expected, status }) => {
    assert.strictEqual(isEnded(status), expected)
  })
})

const NAMES: Record<string, string> = { NVDA: "NVIDIA", AAPL: "Apple" }

describe("describeLeg", () => {
  it.each([
    {
      name: "a buy in dollars",
      leg: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(50_000_000n) } } as const,
      expected: "Buy $50.00 of NVIDIA"
    },
    {
      name: "a sale of half a share",
      leg: { symbol: "AAPL", side: "sell", amount: { shares: Shares.make(50_000_000n) } } as const,
      expected: "Sell 0.5 shares of Apple"
    },
    {
      name: "a sale of one share",
      leg: { symbol: "AAPL", side: "sell", amount: { shares: Shares.make(100_000_000n) } } as const,
      expected: "Sell 1 share of Apple"
    }
  ])("$name", ({ expected, leg }) => {
    assert.strictEqual(describeLeg(leg, (symbol) => NAMES[symbol]!), expected)
  })
})

describe("describeDecision", () => {
  it.each([
    { name: "passes", decision: PASSES, expected: "Within the agent's policies: it sends this itself." },
    {
      name: "over the largest trade",
      decision: OVER,
      expected: "Over the agent's largest trade ($100): it needs your Face ID."
    },
    {
      name: "asking you first",
      decision: { _tag: "Ask" } as const,
      expected: "It asks you first: it needs your Face ID."
    },
    {
      name: "refused",
      decision: REFUSED,
      expected: "Blocked by Max in one stock: Would put too much of your money in NVDA."
    },
    {
      name: "waiting for prices",
      decision: WAIT,
      expected: "Waiting: prices are paused and this agent doesn't trade on them."
    },
    {
      name: "waiting for gas to cost less",
      decision: { _tag: "Wait", reason: "gasPrice", until: DateTime.makeUnsafe("2026-11-30T14:30:00Z") } as const,
      expected: "Waiting: gas costs more right now than this agent's daily gas budget allows."
    },
    {
      name: "waiting for tomorrow's gas budget",
      decision: { _tag: "Wait", reason: "gasSpent", until: DateTime.makeUnsafe("2026-12-01T00:00:00Z") } as const,
      expected: "Waiting: this agent has used today's gas budget."
    }
  ])("$name", ({ decision, expected }) => {
    assert.strictEqual(describeDecision(decision), expected)
  })
})
