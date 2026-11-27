import { assert, describe, it } from "@effect/vitest"
import { TERMS, updatedText } from "../../../../../src/features/legal/model/documents.ts"

describe("updatedText", () => {
  it("the day as the page says it", () => {
    assert.strictEqual(updatedText({ ...TERMS, updated: "2026-11-25" }), "25 November 2026")
  })

  it("the first of a month, in no time zone", () => {
    assert.strictEqual(updatedText({ ...TERMS, updated: "2026-01-01" }), "1 January 2026")
  })
})
