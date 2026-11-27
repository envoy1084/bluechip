import { assert, describe, it } from "@effect/vitest"

import { sizeOf, tileLayouts } from "../../../posthog/Layout.ts"
import { event, funnel, paths, retention, trends } from "../../../posthog/Queries.ts"

describe("sizeOf", () => {
  it.each([
    {
      name: "a big number: a counter",
      query: trends([event("signed_up")], { display: "BoldNumber" }),
      expected: "counter"
    },
    { name: "a line chart: half a row", query: trends([event("signed_up")]), expected: "half" },
    { name: "a table: half a row", query: trends([event("signed_up")], { display: "ActionsTable" }), expected: "half" },
    {
      name: "a funnel: the whole row",
      query: funnel([event("signed_up"), event("trade_filled")], { window: [7, "day"] }),
      expected: "full"
    },
    { name: "retention: the whole row", query: retention("signed_up", { event: "trade_filled" }), expected: "full" },
    { name: "paths: the whole row", query: paths({ from: "signed_up" }), expected: "full" },
    { name: "something else: half a row", query: { kind: "HogQLQuery" }, expected: "half" }
  ])("$name", ({ expected, query }) => {
    assert.strictEqual(sizeOf(query), expected)
  })
})

describe("tileLayouts", () => {
  it("four counters, two charts and a funnel: a row of each", () => {
    assert.deepStrictEqual(tileLayouts(["counter", "counter", "counter", "counter", "half", "half", "full"]), [
      { sm: { x: 0, y: 0, w: 3, h: 5 }, xs: { x: 0, y: 0, w: 1, h: 5 } },
      { sm: { x: 3, y: 0, w: 3, h: 5 }, xs: { x: 0, y: 5, w: 1, h: 5 } },
      { sm: { x: 6, y: 0, w: 3, h: 5 }, xs: { x: 0, y: 10, w: 1, h: 5 } },
      { sm: { x: 9, y: 0, w: 3, h: 5 }, xs: { x: 0, y: 15, w: 1, h: 5 } },
      { sm: { x: 0, y: 5, w: 6, h: 6 }, xs: { x: 0, y: 20, w: 1, h: 6 } },
      { sm: { x: 6, y: 5, w: 6, h: 6 }, xs: { x: 0, y: 26, w: 1, h: 6 } },
      { sm: { x: 0, y: 11, w: 12, h: 6 }, xs: { x: 0, y: 32, w: 1, h: 6 } }
    ])
  })

  it("three counters fill their row", () => {
    assert.deepStrictEqual(tileLayouts(["counter", "counter", "counter"]).map(({ sm }) => [sm.x, sm.w]), [
      [0, 4],
      [4, 4],
      [8, 4]
    ])
  })

  it("five counters: four on the first row, one across the second", () => {
    assert.deepStrictEqual(
      tileLayouts(["counter", "counter", "counter", "counter", "counter"]).map(({ sm }) => [sm.x, sm.y, sm.w]),
      [[0, 0, 3], [3, 0, 3], [6, 0, 3], [9, 0, 3], [0, 5, 12]]
    )
  })

  it("a chart alone before a funnel takes its row", () => {
    assert.deepStrictEqual(tileLayouts(["half", "full", "half", "half"]).map(({ sm }) => [sm.x, sm.y, sm.w]), [
      [0, 0, 12],
      [0, 6, 12],
      [0, 12, 6],
      [6, 12, 6]
    ])
  })

  it("no tiles: no layouts", () => {
    assert.deepStrictEqual(tileLayouts([]), [])
  })
})
