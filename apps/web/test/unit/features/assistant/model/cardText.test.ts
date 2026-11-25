import { Conflict, InvalidSpec, QuoteUnavailable, Unavailable } from "@bluechip/domain/Errors"
import { PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { cardProblem, hasExpired, signingProblem } from "../../../../../src/features/assistant/model/cardText.ts"

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
