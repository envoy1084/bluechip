import type { AgentStatus } from "@bluechip/domain/agents/Agent"
import { Conflict, InvalidSpec, QuoteUnavailable, Unavailable } from "@bluechip/domain/Errors"
import { PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  type AgentCardAction,
  agentOutcome,
  cardProblem,
  hasExpired,
  signingProblem
} from "../../../../../src/features/assistant/model/cardText.ts"

const INVALID = new InvalidSpec({
  problems: [
    new PolicyProblem({ policy: "trade", field: "stocks", message: "Pick at least one stock." }),
    new PolicyProblem({ policy: "tradeSize", field: null, message: "Trades can't be bigger than the budget." })
  ]
})

describe("cardProblem", () => {
  it.each<{ name: string; error: unknown; expected: string }>([
    {
      name: "answered already",
      error: new Conflict({ reason: "cardClosed" }),
      expected: "This was already answered, so there's nothing left to do."
    },
    {
      name: "invalid policies: each problem",
      error: INVALID,
      expected: "Pick at least one stock. Trades can't be bigger than the budget."
    },
    {
      name: "anything else",
      error: new Unavailable({ dependency: "database", retryAfterSeconds: null }),
      expected: "We couldn't reach bluechip just now. Nothing changed, so try again."
    }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(cardProblem(error), expected)
  })
})

describe("signingProblem", () => {
  it.each<{ name: string; error: unknown; expected: string }>([
    {
      name: "invalid policies: each problem",
      error: INVALID,
      expected: "Pick at least one stock. Trades can't be bigger than the budget."
    },
    {
      name: "another change on its way",
      error: new Conflict({ reason: "staleUpdate" }),
      expected: "This agent has another change on its way. Try again once it lands."
    },
    {
      name: "Base unreachable",
      error: new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }),
      expected: "We couldn't reach Base just now. Nothing changed, so try again in a moment."
    },
    {
      name: "no ETH for the network fee: what's missing and what to do",
      error: new Unavailable({ dependency: "gas", retryAfterSeconds: null }),
      expected:
        "Your account has no ETH to pay Base's network fee. Send a little ETH on Base to your account's address, then try again. Nothing changed."
    },
    {
      name: "anything else: Face ID cancelled",
      error: new QuoteUnavailable({ symbol: "NVDA", reason: "noPrice" }),
      expected: "Face ID was cancelled or the request couldn't be sent. Nothing changed."
    }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(signingProblem(error), expected)
  })
})

describe("hasExpired", () => {
  it.each<{ name: string; expiresAt: string; expected: boolean }>([
    { name: "a request that ran out", expiresAt: "2000-01-01T00:00:00Z", expected: true },
    { name: "a request still good", expiresAt: "2999-01-01T00:00:00Z", expected: false }
  ])("$name", ({ expected, expiresAt }) => {
    assert.strictEqual(hasExpired(DateTime.makeUnsafe(expiresAt)), expected)
  })
})

describe("agentOutcome", () => {
  it.each<{
    name: string
    action: AgentCardAction
    status: AgentStatus
    expected: ReturnType<typeof agentOutcome>
  }>([
    {
      name: "a lock on its way",
      action: "lock",
      status: "locking",
      expected: { tone: "pending", title: "Locking Nimbus's rules", description: "Base takes a couple of seconds." }
    },
    {
      name: "a lock landed",
      action: "lock",
      status: "active",
      expected: { tone: "success", title: "Nimbus is live", description: "It trades inside its rules." }
    },
    {
      name: "a change on its way",
      action: "update",
      status: "updating",
      expected: { tone: "pending", title: "Changing Nimbus's rules", description: "Base takes a couple of seconds." }
    },
    {
      name: "a change landed",
      action: "update",
      status: "active",
      expected: { tone: "success", title: "Nimbus's new rules are locked", description: "It trades inside its rules." }
    },
    {
      name: "a renewal on its way",
      action: "renew",
      status: "updating",
      expected: { tone: "pending", title: "Renewing Nimbus", description: "Base takes a couple of seconds." }
    },
    {
      name: "a renewal landed",
      action: "renew",
      status: "active",
      expected: { tone: "success", title: "Nimbus is renewed", description: "It trades inside its rules." }
    },
    {
      name: "a removal on its way",
      action: "remove",
      status: "removing",
      expected: { tone: "pending", title: "Removing Nimbus", description: "Base takes a couple of seconds." }
    },
    {
      name: "a removal landed",
      action: "remove",
      status: "removed",
      expected: {
        tone: "success",
        title: "Nimbus is removed",
        description: "Your stocks and cash stay in your account."
      }
    },
    { name: "a removal that failed back to active", action: "remove", status: "active", expected: null },
    { name: "a lock not sent yet", action: "lock", status: "draft", expected: null },
    { name: "a renewal that failed back to expired", action: "renew", status: "expired", expected: null }
  ])("$name", ({ action, expected, status }) => {
    assert.deepStrictEqual(agentOutcome(action, status, "Nimbus"), expected)
  })
})
