import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  exportFileName,
  groupMemories,
  matchesMemory,
  provenance,
  usage
} from "../../../../../src/features/assistant/model/memoryText.ts"
import { MEMORY } from "../../../../fixtures/Memories.ts"

describe("provenance", () => {
  it.each(
    [
      { name: "said", memory: MEMORY, expected: "You said it, on Fri 20 Nov, 10:00" },
      {
        name: "inferred, with how sure",
        memory: { ...MEMORY, source: "inferred", confidence: 0.724 },
        expected: "Inferred, 72% sure, on Fri 20 Nov, 10:00"
      }
    ] as const
  )("$name", ({ expected, memory }) => {
    assert.strictEqual(provenance(memory as never, "UTC"), expected)
  })

  it("in the viewer's time zone", () => {
    assert.strictEqual(provenance(MEMORY, "Asia/Tokyo"), "You said it, on Fri 20 Nov, 19:00")
  })
})

describe("usage", () => {
  it.each([
    { name: "never used", uses: 0, lastUsedAt: null, expected: "Not used in an answer yet" },
    { name: "used, not knowing when", uses: 3, lastUsedAt: null, expected: "Used in 3 answers" },
    {
      name: "once, just now",
      uses: 1,
      lastUsedAt: "2026-11-27T11:59:50Z",
      expected: "Used in 1 answer, last just now"
    },
    { name: "hours ago", uses: 3, lastUsedAt: "2026-11-27T09:00:00Z", expected: "Used in 3 answers, last 3 h ago" },
    {
      name: "the day before",
      uses: 2,
      lastUsedAt: "2026-11-26T08:00:00Z",
      expected: "Used in 2 answers, last yesterday"
    },
    {
      name: "two days or more: the day",
      uses: 4,
      lastUsedAt: "2026-11-18T08:00:00Z",
      expected: "Used in 4 answers, last on Wed 18 Nov"
    }
  ])("$name", ({ expected, lastUsedAt, uses }) => {
    assert.strictEqual(
      usage(
        { uses, lastUsedAt: lastUsedAt === null ? null : DateTime.makeUnsafe(lastUsedAt) },
        new Date("2026-11-27T12:00:00Z"),
        "UTC"
      ),
      expected
    )
  })
})

describe("groupMemories", () => {
  it("guesses first, then the kept ones by kind in the page's order, leaving out empty kinds", () => {
    const confirmedAt = DateTime.makeUnsafe("2026-11-20T10:00:00Z")
    const memories = [
      { id: "fact", kind: "fact", confirmedAt },
      { id: "guess", kind: "preference", confirmedAt: null },
      { id: "rule 1", kind: "constraint", confirmedAt },
      { id: "goal", kind: "goal", confirmedAt },
      { id: "rule 2", kind: "constraint", confirmedAt }
    ] as const

    const { groups, toConfirm } = groupMemories(memories)

    assert.deepStrictEqual(toConfirm.map((memory) => memory.id), ["guess"])
    assert.deepStrictEqual(
      groups.map((group) => [group.label, group.memories.map((memory) => memory.id)]),
      [["Rules", ["rule 1", "rule 2"]], ["Goals", ["goal"]], ["Facts", ["fact"]]]
    )
  })

  it("nothing to group", () => {
    assert.deepStrictEqual(groupMemories([]), { toConfirm: [], groups: [] })
  })
})

describe("matchesMemory", () => {
  it.each([
    { name: "a word of the memory", search: "tesla", expected: true },
    { name: "its kind and its agent", search: "rule picker", expected: true },
    { name: "a word that isn't there", search: "nintendo", expected: false },
    { name: "an empty search", search: " ", expected: true }
  ])("$name", ({ expected, search }) => {
    assert.strictEqual(matchesMemory(["You never want Tesla.", "Rule", "Tech picker"], search), expected)
  })
})

describe("exportFileName", () => {
  it("names the file by the UTC day", () => {
    assert.strictEqual(
      exportFileName(DateTime.makeUnsafe("2026-11-26T23:30:00Z")),
      "bluechip-memory-2026-11-26.json"
    )
  })
})
