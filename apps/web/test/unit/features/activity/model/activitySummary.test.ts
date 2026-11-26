import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { activityTotals, summaryTiles } from "../../../../../src/features/activity/model/activitySummary.ts"
import { appleTrade, cashTransfer } from "../../../../fixtures/Activity.ts"

describe("activityTotals", () => {
  it("nothing listed: all zero", () => {
    assert.deepStrictEqual(activityTotals([]), {
      bought: 0n,
      buys: 0,
      sold: 0n,
      sells: 0,
      added: 0n,
      deposits: 0,
      withdrew: 0n,
      withdrawals: 0
    })
  })

  it("filled trades and landed cash count, by side and direction", () => {
    const items = [
      appleTrade(),
      appleTrade({ usdc: Usdc.make(7_050_000n) }),
      appleTrade({ side: "sell", usdc: Usdc.make(40_000_000n) }),
      cashTransfer({ kind: "deposit", amount: 500_000_000n }),
      cashTransfer()
    ]

    assert.deepStrictEqual(activityTotals(items), {
      bought: 100_000_000n,
      buys: 2,
      sold: 40_000_000n,
      sells: 1,
      added: 500_000_000n,
      deposits: 1,
      withdrew: 15_000_000n,
      withdrawals: 1
    })
  })

  it("trades on their way or failed, transfers pending or failed, and stock moved count for nothing", () => {
    const items = [
      appleTrade({ status: "sending" }),
      appleTrade({ status: "failed" }),
      cashTransfer({ status: "pending" }),
      cashTransfer({ status: "failed" }),
      cashTransfer({ kind: "deposit", asset: "AAPL" })
    ]

    assert.deepStrictEqual(activityTotals(items), activityTotals([]))
  })
})

describe("summaryTiles", () => {
  const totals = {
    bought: 100_000_000n,
    buys: 2,
    sold: 40_000_000n,
    sells: 1,
    added: 0n,
    deposits: 0,
    withdrew: 15_000_000n,
    withdrawals: 1
  }

  it("all: trades' tiles, then cash's", () => {
    assert.deepStrictEqual(summaryTiles(totals, "all"), [
      { label: "Bought", value: "$100.00", detail: "2 buys" },
      { label: "Sold", value: "$40.00", detail: "1 sale" },
      { label: "Added", value: "None", detail: "In this period" },
      { label: "Withdrew", value: "$15.00", detail: "1 withdrawal" }
    ])
  })

  it("trades: only what was bought and sold", () => {
    assert.deepStrictEqual(summaryTiles(totals, "trades").map((tile) => tile.label), ["Bought", "Sold"])
  })

  it("cash: only what came in and went out", () => {
    assert.deepStrictEqual(summaryTiles(totals, "cash").map((tile) => tile.label), ["Added", "Withdrew"])
  })
})
