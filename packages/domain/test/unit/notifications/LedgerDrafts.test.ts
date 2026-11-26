import { notificationOfAdjustment } from "@bluechip/domain/notifications/LedgerDrafts"
import { assert, describe, it } from "@effect/vitest"

describe("notificationOfAdjustment", () => {
  it("an opening balance tells nothing", () => {
    const draft = notificationOfAdjustment({ id: "adjustment_1", asset: "USDC", amount: 5n, reason: "opening" }, "USDC")

    assert.isUndefined(draft)
  })

  it.each(
    [
      {
        name: "a share that arrived",
        adjustment: { id: "adjustment_1", asset: "MSFT", amount: 100_000_000n, reason: "transferIn" },
        expected: "1 share of Microsoft arrived from outside bluechip"
      },
      {
        name: "shares that left",
        adjustment: { id: "adjustment_1", asset: "MSFT", amount: -250_000_000n, reason: "transferOut" },
        expected: "2.5 shares of Microsoft left your account outside bluechip"
      },
      {
        name: "cash that appeared",
        adjustment: { id: "adjustment_1", asset: "USDC", amount: 12_000_000n, reason: "unexplained" },
        expected: "$12.00 of USDC appeared in your account"
      },
      {
        name: "cash that left",
        adjustment: { id: "adjustment_1", asset: "USDC", amount: -1_500_000n, reason: "unexplained" },
        expected: "$1.50 of USDC left your account"
      }
    ] as const
  )("$name", ({ adjustment, expected }) => {
    const draft = notificationOfAdjustment(adjustment, "Microsoft")

    assert.deepStrictEqual(
      [draft?.kind, draft?.title, draft?.link, draft?.dedupeKey],
      ["balanceUnexplained", expected, "/portfolio", "balanceUnexplained:adjustment_1"]
    )
  })
})
