import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { exportFileName, provenance, usage } from "../../../../../src/features/assistant/model/memoryText.ts"
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
    { uses: 0, expected: "Not used in an answer yet" },
    { uses: 1, expected: "Used in 1 answer" },
    { uses: 3, expected: "Used in 3 answers" }
  ])("$uses", ({ expected, uses }) => {
    assert.strictEqual(usage({ uses }), expected)
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
