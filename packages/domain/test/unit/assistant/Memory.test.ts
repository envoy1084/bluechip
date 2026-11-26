import { type MemoryCandidate, type MemoryWrite, planMemoryWrite, summaryCut } from "@bluechip/domain/assistant/Memory"
import { MemoryId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const AVOID_TESLA = MemoryId.make("memory_01jd8v4t5m6n7p8q9r0s1t2v3w")
const LIKES_CHIPS = MemoryId.make("memory_01jd8v4t5m6n7p8q9r0s1t2v3x")
const CONFIRMED = DateTime.makeUnsafe("2026-11-20T10:00:00Z")

const existing = [
  { id: AVOID_TESLA, kind: "preference", text: "You avoid Tesla.", confirmedAt: CONFIRMED },
  { id: LIKES_CHIPS, kind: "goal", text: "You want more chip makers.", confirmedAt: null }
] as const

describe("planMemoryWrite", () => {
  it.each<{ name: string; candidate: MemoryCandidate; expected: MemoryWrite }>([
    {
      name: "blank text is dropped",
      candidate: { kind: "fact", text: "  ", source: "said", confidence: 1, replaces: null },
      expected: { _tag: "Skip", reason: "invalid" }
    },
    {
      name: "text of 300 characters is kept",
      candidate: { kind: "fact", text: "a".repeat(300), source: "said", confidence: 1, replaces: null },
      expected: { _tag: "Add", confirmed: true }
    },
    {
      name: "text over 300 characters is dropped",
      candidate: { kind: "fact", text: "a".repeat(301), source: "said", confidence: 1, replaces: null },
      expected: { _tag: "Skip", reason: "invalid" }
    },
    {
      name: "a guess under 0.5 is dropped",
      candidate: { kind: "fact", text: "You live in Berlin.", source: "inferred", confidence: 0.49, replaces: null },
      expected: { _tag: "Skip", reason: "unsure" }
    },
    {
      name: "a guess of exactly 0.5 is kept, unconfirmed",
      candidate: { kind: "fact", text: "You live in Berlin.", source: "inferred", confidence: 0.5, replaces: null },
      expected: { _tag: "Add", confirmed: false }
    },
    {
      name: "a guess just under 0.8 waits for the user",
      candidate: { kind: "fact", text: "You live in Berlin.", source: "inferred", confidence: 0.79, replaces: null },
      expected: { _tag: "Add", confirmed: false }
    },
    {
      name: "a guess of 0.8 is confirmed",
      candidate: { kind: "fact", text: "You live in Berlin.", source: "inferred", confidence: 0.8, replaces: null },
      expected: { _tag: "Add", confirmed: true }
    },
    {
      name: "something said is confirmed however sure the model is",
      candidate: { kind: "constraint", text: "You never buy oil.", source: "said", confidence: 0.6, replaces: null },
      expected: { _tag: "Add", confirmed: true }
    },
    {
      name: "a repeat of a confirmed memory, in other case and punctuation, is skipped",
      candidate: { kind: "preference", text: "you avoid tesla", source: "said", confidence: 1, replaces: null },
      expected: { _tag: "Skip", reason: "duplicate" }
    },
    {
      name: "a confident repeat of an unconfirmed memory confirms it",
      candidate: { kind: "goal", text: "You want more chip makers!", source: "said", confidence: 0.9, replaces: null },
      expected: { _tag: "Refresh", memoryId: LIKES_CHIPS, confirm: true }
    },
    {
      name: "an unsure repeat of an unconfirmed memory changes nothing",
      candidate: {
        kind: "goal",
        text: "You want more chip makers.",
        source: "inferred",
        confidence: 0.6,
        replaces: null
      },
      expected: { _tag: "Skip", reason: "duplicate" }
    },
    {
      name: "the same words of another kind are a new memory",
      candidate: { kind: "fact", text: "You avoid Tesla.", source: "said", confidence: 1, replaces: null },
      expected: { _tag: "Add", confirmed: true }
    },
    {
      name: "a contradiction replaces the memory it names, with a note",
      candidate: {
        kind: "preference",
        text: "You like Tesla now.",
        source: "said",
        confidence: 1,
        replaces: AVOID_TESLA
      },
      expected: { _tag: "Replace", memoryId: AVOID_TESLA, confirmed: true, note: "Replaces \"You avoid Tesla.\"" }
    },
    {
      name: "a contradiction of a memory that doesn't exist is added",
      candidate: {
        kind: "preference",
        text: "You like Tesla now.",
        source: "said",
        confidence: 1,
        replaces: "memory_01jd8v4t5m6n7p8q9r0s1t2v3z"
      },
      expected: { _tag: "Add", confirmed: true }
    }
  ])("$name", ({ candidate, expected }) => {
    assert.deepStrictEqual(planMemoryWrite(existing, candidate), expected)
  })
})

describe("summaryCut", () => {
  it.each([
    { name: "12 messages since the start are not due", messages: 12, summarized: 0, expected: undefined },
    { name: "13 messages since the start cut before the last 4 turns", messages: 13, summarized: 0, expected: 6 },
    { name: "16 messages cut at the 5th turn from the end", messages: 16, summarized: 0, expected: 8 },
    { name: "12 messages after the summary are not due", messages: 20, summarized: 8, expected: undefined },
    { name: "13 after the summary move it on", messages: 22, summarized: 8, expected: 14 }
  ])("$name, turns taking turns", ({ expected, messages, summarized }) => {
    const roles = Array.from(
      { length: messages },
      (_, index) => index % 2 === 0 ? "user" as const : "assistant" as const
    )

    assert.strictEqual(summaryCut(roles, summarized), expected)
  })

  it("long answers without 5 turns are not due", () => {
    const roles = ["user" as const, ...Array.from({ length: 20 }, () => "assistant" as const)]

    assert.strictEqual(summaryCut(roles, 0), undefined)
  })
})
