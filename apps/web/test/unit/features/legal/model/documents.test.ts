import { assert, describe, it } from "@effect/vitest"
import { legalMarkdown, TERMS, updatedText } from "../../../../../src/features/legal/model/documents.ts"

describe("updatedText", () => {
  it("the day as the page says it", () => {
    assert.strictEqual(updatedText({ ...TERMS, updated: "2026-11-25" }), "25 November 2026")
  })

  it("the first of a month, in no time zone", () => {
    assert.strictEqual(updatedText({ ...TERMS, updated: "2026-01-01" }), "1 January 2026")
  })
})

describe("legalMarkdown", () => {
  it("the title, date, intro and each section, as the page shows them", () => {
    const legal = {
      ...TERMS,
      updated: "2026-11-25",
      intro: "Preview terms.",
      sections: [["Who can use it", "People outside the US."], ["Fees", "None of our own."]] as const
    }
    assert.strictEqual(
      legalMarkdown(legal),
      [
        "# Terms of use",
        "",
        "Last updated 25 November 2026.",
        "",
        "Preview terms.",
        "",
        "## Who can use it",
        "",
        "People outside the US.",
        "",
        "## Fees",
        "",
        "None of our own.",
        ""
      ].join("\n")
    )
  })
})
