import { assert, describe, it } from "@effect/vitest"
import { receiptWhen } from "../../../../../src/features/activity/model/receipt.ts"

describe("receiptWhen", () => {
  const now = new Date("2026-11-26T15:00:00Z")

  it.each([
    { name: "earlier today", at: "2026-11-26T09:41:00Z", expected: "Today at 09:41" },
    { name: "yesterday", at: "2026-11-25T16:02:00Z", expected: "Yesterday at 16:02" },
    { name: "before that, by its date", at: "2026-11-21T10:00:00Z", expected: "On 21 Nov at 10:00" }
  ])("$name", ({ at, expected }) => {
    assert.strictEqual(receiptWhen(new Date(at), now, "UTC"), expected)
  })

  it("the day is the viewer's: the same day in UTC, the night before in New York", () => {
    assert.strictEqual(
      receiptWhen(new Date("2026-11-26T04:30:00Z"), new Date("2026-11-26T15:00:00Z"), "America/New_York"),
      "Yesterday at 23:30"
    )
  })
})
