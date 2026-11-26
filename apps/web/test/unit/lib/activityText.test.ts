import { assert, describe, it } from "@effect/vitest"
import { activityDetail, activityProblem, activityStatus, activityTitle } from "../../../src/lib/activityText.ts"
import { appleTrade, cashTransfer, NAMES } from "../../fixtures/Activity.ts"

describe("activityTitle", () => {
  it.each([
    { name: "a filled buy", item: appleTrade(), expected: "Bought $92.95 of Apple" },
    { name: "a filled sale", item: appleTrade({ side: "sell" }), expected: "Sold $92.95 of Apple" },
    { name: "a buy on its way", item: appleTrade({ status: "confirming" }), expected: "Buying $92.95 of Apple" },
    {
      name: "a sale being sent",
      item: appleTrade({ side: "sell", status: "sending" }),
      expected: "Selling $92.95 of Apple"
    },
    { name: "a buy that didn't go through", item: appleTrade({ status: "failed" }), expected: "Buy $92.95 of Apple" },
    { name: "a deposit", item: cashTransfer({ kind: "deposit" }), expected: "Added $15.00" },
    { name: "a withdrawal that landed", item: cashTransfer(), expected: "Withdrew $15.00" },
    { name: "a withdrawal on its way", item: cashTransfer({ status: "pending" }), expected: "Withdrew $15.00" },
    { name: "a withdrawal that failed", item: cashTransfer({ status: "failed" }), expected: "Withdrawal of $15.00" },
    {
      name: "shares of a stock arriving",
      item: cashTransfer({ kind: "deposit", asset: "AAPL", amount: 50_000_000n }),
      expected: "Added 0.5 shares of Apple"
    }
  ])("$name", ({ item, expected }) => {
    assert.strictEqual(activityTitle(item, NAMES), expected)
  })
})

describe("activityDetail", () => {
  it.each([
    { name: "a filled trade: its shares and price", item: appleTrade(), expected: "0.38841567 shares at $239.30" },
    {
      name: "a trade on its way: the quote",
      item: appleTrade({ status: "sending" }),
      expected: "About 0.38841567 shares at $239.30"
    },
    {
      name: "a sale that failed: nothing moved",
      item: appleTrade({ side: "sell", status: "failed" }),
      expected: "Nothing was sold. Your stocks are where they were."
    },
    {
      name: "a deposit: where it came from",
      item: cashTransfer({ kind: "deposit" }),
      expected: "From 0x0000…dEaD on Base"
    },
    { name: "a withdrawal: where it went", item: cashTransfer(), expected: "To 0x0000…dEaD on Base" },
    {
      name: "a withdrawal that failed",
      item: cashTransfer({ status: "failed" }),
      expected: "Your cash is where it was."
    }
  ])("$name", ({ item, expected }) => {
    assert.strictEqual(activityDetail(item), expected)
  })
})

describe("activityStatus", () => {
  it.each([
    { name: "sending", item: appleTrade({ status: "sending" }), expected: { label: "Sending", tone: "pending" } },
    {
      name: "confirming",
      item: appleTrade({ status: "confirming" }),
      expected: { label: "Confirming", tone: "pending" }
    },
    { name: "filled", item: appleTrade(), expected: { label: "Filled", tone: "done" } },
    {
      name: "a failed trade",
      item: appleTrade({ status: "failed" }),
      expected: { label: "Didn't go through", tone: "failed" }
    },
    { name: "a deposit", item: cashTransfer({ kind: "deposit" }), expected: { label: "Arrived", tone: "done" } },
    { name: "a withdrawal sent", item: cashTransfer(), expected: { label: "Sent", tone: "done" } },
    {
      name: "a pending withdrawal",
      item: cashTransfer({ status: "pending" }),
      expected: { label: "On its way", tone: "pending" }
    },
    {
      name: "a failed withdrawal",
      item: cashTransfer({ status: "failed" }),
      expected: { label: "Didn't go through", tone: "failed" }
    }
  ])("$name", ({ item, expected }) => {
    assert.deepStrictEqual(activityStatus(item), expected)
  })
})

describe("activityProblem", () => {
  it.each([
    { name: "a filled trade", item: appleTrade(), expected: null },
    { name: "a failed trade", item: appleTrade({ status: "failed" }), expected: "Base didn't take this trade." },
    { name: "a pending withdrawal", item: cashTransfer({ status: "pending" }), expected: null },
    {
      name: "a failed withdrawal",
      item: cashTransfer({ status: "failed" }),
      expected: "Base didn't take this withdrawal."
    },
    {
      name: "a failed deposit",
      item: cashTransfer({ kind: "deposit", status: "failed" }),
      expected: "This deposit didn't land."
    }
  ])("$name", ({ item, expected }) => {
    assert.strictEqual(activityProblem(item), expected)
  })
})
