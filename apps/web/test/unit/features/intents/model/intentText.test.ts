import { Conflict, InsufficientCash, Unavailable } from "@bluechip/domain/Errors"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  askedAt,
  clockTime,
  expiresIn,
  intentProblem,
  nothingMoved,
  waitingText
} from "../../../../../src/features/intents/model/intentText.ts"
import { nvidiaBuy } from "../../../../fixtures/Intents.ts"

const NOW = new Date("2026-11-26T12:00:00Z")

describe("nothingMoved", () => {
  it.each<{ side: "buy" | "sell"; expected: string }>([
    { side: "buy", expected: "Nothing was bought. Your cash is where it was." },
    { side: "sell", expected: "Nothing was sold. Your stocks are where they were." }
  ])("$side", ({ expected, side }) => {
    assert.strictEqual(nothingMoved(side), expected)
  })
})

// The project runs in UTC (vitest.config.ts), so the viewer's own clock reads UTC here.
describe("askedAt", () => {
  it.each<{ name: string; createdAt: string; expected: string }>([
    { name: "moments ago", createdAt: "2026-11-26T11:59:30Z", expected: "Just now" },
    { name: "minutes ago", createdAt: "2026-11-26T11:58:00Z", expected: "2 min ago" },
    { name: "yesterday", createdAt: "2026-11-25T10:00:00Z", expected: "Yesterday" },
    {
      name: "days ago: the date in the viewer's zone",
      createdAt: "2026-11-20T09:05:00Z",
      expected: "Fri 20 Nov, 09:05"
    }
  ])("$name", ({ createdAt, expected }) => {
    assert.strictEqual(askedAt(nvidiaBuy(createdAt), NOW), expected)
  })
})

describe("clockTime", () => {
  it("the viewer's own clock time", () => {
    assert.strictEqual(clockTime(DateTime.makeUnsafe("2026-11-26T14:30:00Z")), "14:30")
  })
})

describe("expiresIn", () => {
  it.each<{ name: string; at: string; expected: string }>([
    { name: "past: expired", at: "2026-11-26T11:59:00Z", expected: "Expired" },
    { name: "now: expired", at: "2026-11-26T12:00:00Z", expected: "Expired" },
    { name: "seconds away: a minute", at: "2026-11-26T12:00:01Z", expected: "Expires in 1 min" },
    { name: "just under an hour: minutes", at: "2026-11-26T12:59:00Z", expected: "Expires in 59 min" },
    { name: "an hour: hours", at: "2026-11-26T13:00:00Z", expected: "Expires in 1 h" },
    { name: "hours, rounded", at: "2026-11-26T14:40:00Z", expected: "Expires in 3 h" }
  ])("$name", ({ at, expected }) => {
    assert.strictEqual(expiresIn(DateTime.makeUnsafe(at), NOW), expected)
  })
})

describe("intentProblem", () => {
  it.each<{ name: string; error: unknown; expected: string }>([
    {
      name: "the agent can't trade",
      error: new Conflict({ reason: "agentBusy" }),
      expected: "This agent can't trade right now: it's paused, not locked or changing."
    },
    {
      name: "the trade moved on",
      error: new Conflict({ reason: "intentClosed" }),
      expected: "This trade has already moved on, so there's nothing to do."
    },
    {
      name: "Base unreachable",
      error: new Unavailable({ dependency: "chain", retryAfterSeconds: null }),
      expected: "We couldn't reach Base just now. Nothing changed, so try again in a moment."
    },
    {
      name: "another conflict: as a trade problem",
      error: new Conflict({ reason: "requestIdReused" }),
      expected: "Face ID was cancelled or the trade couldn't be sent. Nothing was bought."
    },
    {
      name: "a trade problem",
      error: new InsufficientCash({ available: 5_000_000n }),
      expected: "You have $5.00 in cash."
    }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(intentProblem(error, "buy"), expected)
  })
})

describe("waitingText", () => {
  it.each<{ count: number; expected: string }>([
    { count: 0, expected: "Nothing waiting for you" },
    { count: 1, expected: "1 trade waiting for you" },
    { count: 2, expected: "2 trades waiting for you" }
  ])("$count", ({ count, expected }) => {
    assert.strictEqual(waitingText(count), expected)
  })
})
