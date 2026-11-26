import { dailyRows, dayOf, series } from "@bluechip/domain/ledger/Daily"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

describe("dayOf", () => {
  it.each([
    { at: "2026-11-27T00:00:00Z", expected: "2026-11-27" },
    { at: "2026-11-27T23:59:59.999Z", expected: "2026-11-27" },
    { at: "2026-11-27T22:00:00-05:00", expected: "2026-11-28" }
  ])("$at is $expected", ({ at, expected }) => {
    assert.strictEqual(dayOf(DateTime.makeUnsafe(at)), expected)
  })
})

describe("dailyRows", () => {
  it("nothing traded: no rows", () => {
    assert.deepStrictEqual(dailyRows([], []), [])
  })

  it("trades of one stock on one day add up into one row", () => {
    const rows = dailyRows(
      [
        { day: "2026-11-27", symbol: "NVDA", agentId: null, fee: 50n, slippage: 10n, gasWei: 7n },
        { day: "2026-11-27", symbol: "NVDA", agentId: null, fee: 40n, slippage: -5n, gasWei: 7n }
      ],
      [{ day: "2026-11-27", symbol: "NVDA", agentId: null, realised: 300n }]
    )

    assert.deepStrictEqual(rows, [{
      day: "2026-11-27",
      symbol: "NVDA",
      agentId: null,
      realised: 300n,
      fees: 90n,
      slippage: 5n,
      gasWei: 14n,
      trades: 2
    }])
  })

  it("other days, stocks and agents get rows of their own", () => {
    const rows = dailyRows(
      [
        { day: "2026-11-26", symbol: "NVDA", agentId: null, fee: 1n, slippage: 0n, gasWei: 0n },
        { day: "2026-11-27", symbol: "NVDA", agentId: null, fee: 1n, slippage: 0n, gasWei: 0n },
        { day: "2026-11-27", symbol: "AAPL", agentId: null, fee: 1n, slippage: 0n, gasWei: 0n },
        { day: "2026-11-27", symbol: "NVDA", agentId: "agent_a", fee: 1n, slippage: 0n, gasWei: 0n }
      ],
      []
    )

    assert.deepStrictEqual(rows.map((row) => [row.day, row.symbol, row.agentId, row.trades]), [
      ["2026-11-26", "NVDA", null, 1],
      ["2026-11-27", "NVDA", null, 1],
      ["2026-11-27", "AAPL", null, 1],
      ["2026-11-27", "NVDA", "agent_a", 1]
    ])
  })

  it("a sale's profit counts for the agent that sold, on a day with no trade of its own", () => {
    const rows = dailyRows([], [{ day: "2026-11-27", symbol: "NVDA", agentId: "agent_a", realised: -40n }])

    assert.deepStrictEqual(rows, [{
      day: "2026-11-27",
      symbol: "NVDA",
      agentId: "agent_a",
      realised: -40n,
      fees: 0n,
      slippage: 0n,
      gasWei: 0n,
      trades: 0
    }])
  })
})

describe("series", () => {
  it("no rows: no points", () => {
    assert.deepStrictEqual(series([]), [])
  })

  it("realised profit runs on; unrealised is each day's own", () => {
    const points = series([
      { day: "2026-11-26", realised: 100n, unrealised: 30n },
      { day: "2026-11-27", realised: 20n, unrealised: 10n }
    ])

    assert.deepStrictEqual(points, [
      { day: "2026-11-26", realised: 100n, unrealised: 30n, total: 130n },
      { day: "2026-11-27", realised: 120n, unrealised: 10n, total: 130n }
    ])
  })

  it("rows of one day add up, in any order, and days come oldest first", () => {
    const points = series([
      { day: "2026-11-27", realised: 1n, unrealised: 40n },
      { day: "2026-11-26", realised: 2n, unrealised: 5n },
      { day: "2026-11-27", realised: 3n, unrealised: -10n }
    ])

    assert.deepStrictEqual(points.map((point) => [point.day, point.realised, point.unrealised]), [
      ["2026-11-26", 2n, 5n],
      ["2026-11-27", 6n, 30n]
    ])
  })

  it("a day not measured keeps the last unrealised value; before any, zero", () => {
    const points = series([
      { day: "2026-11-25", realised: 0n, unrealised: null },
      { day: "2026-11-26", realised: 0n, unrealised: 50n },
      { day: "2026-11-27", realised: 0n, unrealised: null }
    ])

    assert.deepStrictEqual(points.map((point) => point.unrealised), [0n, 50n, 50n])
  })
})
