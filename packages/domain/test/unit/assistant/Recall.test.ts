import { fitBudget, fuseRanks, importanceOf, RRF_K, selectMemories, weigh } from "@bluechip/domain/assistant/Recall"
import { assert, describe, it } from "@effect/vitest"
import { CHIPS, GUESS, LISBON, TESLA } from "../../fixtures/Memories.ts"

describe("fuseRanks", () => {
  it.each([
    { name: "no lists", lists: [], expected: [] },
    { name: "one list, by rank", lists: [["a", "b"]], expected: [["a", 1 / (RRF_K + 1)], ["b", 1 / (RRF_K + 2)]] },
    {
      name: "a hit in both lists adds up",
      lists: [["a", "b"], ["b"]],
      expected: [["a", 1 / (RRF_K + 1)], ["b", 1 / (RRF_K + 2) + 1 / (RRF_K + 1)]]
    }
  ])("$name", ({ expected, lists }) => {
    assert.deepStrictEqual([...fuseRanks(lists)], expected)
  })
})

describe("weigh", () => {
  it.each([
    { name: "important and new keeps its score", entry: { fused: 1, importance: 1, ageDays: 0 }, expected: 1 },
    { name: "unimportant halves it", entry: { fused: 1, importance: 0, ageDays: 0 }, expected: 0.5 },
    {
      name: "one half-life old counts three quarters",
      entry: { fused: 1, importance: 1, ageDays: 60 },
      expected: 0.75
    },
    { name: "very old counts half at least", entry: { fused: 1, importance: 1, ageDays: 100_000 }, expected: 0.5 },
    { name: "a time in the future counts as now", entry: { fused: 1, importance: 1, ageDays: -5 }, expected: 1 }
  ])("$name", ({ entry, expected }) => {
    assert.closeTo(weigh(entry), expected, 1e-9)
  })
})

describe("importanceOf", () => {
  it.each(
    [
      {
        name: "a limit you set",
        entry: { kind: "memory", memory: { kind: "constraint", confidence: 1 } },
        expected: 1
      },
      {
        name: "a guess, by how sure",
        entry: { kind: "memory", memory: { kind: "fact", confidence: 0.5 } },
        expected: 0.35
      },
      { name: "a summary", entry: { kind: "summary" }, expected: 0.6 },
      { name: "a journal entry", entry: { kind: "journal" }, expected: 0.5 },
      { name: "a message", entry: { kind: "message" }, expected: 0.4 }
    ] as const
  )("$name", ({ entry, expected }) => {
    assert.closeTo(importanceOf(entry), expected, 1e-9)
  })
})

describe("fitBudget", () => {
  it.each([
    { name: "everything fits", budget: 10, expected: ["aaa", "bbbb", "c"] },
    { name: "exactly the budget fits", budget: 7, expected: ["aaa", "bbbb"] },
    { name: "one too long is skipped, the next tried", budget: 5, expected: ["aaa", "c"] },
    { name: "a budget of nothing keeps nothing", budget: 0, expected: [] }
  ])("$name", ({ budget, expected }) => {
    const items = [{ text: "aaa" }, { text: "bbbb" }, { text: "c" }]

    assert.deepStrictEqual(fitBudget(items, budget).map((item) => item.text), expected)
  })
})

describe("selectMemories", () => {
  it.each([
    { name: "limits first, then the rest newest first", relevant: [], budget: 1000, expected: [TESLA, CHIPS, LISBON] },
    { name: "recalled ones come after limits", relevant: [LISBON.id], budget: 1000, expected: [TESLA, LISBON, CHIPS] },
    { name: "the budget drops the last", relevant: [LISBON.id], budget: 40, expected: [TESLA, LISBON] },
    {
      name: "a guess is never selected, even recalled",
      relevant: [GUESS.id],
      budget: 1000,
      expected: [TESLA, CHIPS, LISBON]
    }
  ])("$name", ({ budget, expected, relevant }) => {
    assert.deepStrictEqual(selectMemories([LISBON, CHIPS, TESLA, GUESS], relevant, budget), expected)
  })
})
