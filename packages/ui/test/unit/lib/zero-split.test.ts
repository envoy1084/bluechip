import { signedColor, signedPaint, zeroOffset } from "@bluechip/ui/lib/zero-split"
import { assert, describe, it } from "@effect/vitest"

const COLORS = { above: "blue", below: "red" }

describe("zeroOffset", () => {
  it("a span across zero: zero's share down from the top", () => {
    assert.strictEqual(zeroOffset(-10, 30), 0.75)
  })

  it("a span above zero: the bottom", () => {
    assert.strictEqual(zeroOffset(5, 20), 1)
  })

  it("a span below zero: the top", () => {
    assert.strictEqual(zeroOffset(-20, -5), 0)
  })

  it("a span ending on zero: the bottom", () => {
    assert.strictEqual(zeroOffset(0, 8), 1)
  })

  it("a span starting on zero: the top", () => {
    assert.strictEqual(zeroOffset(-8, 0), 0)
  })

  it("a flat span: none", () => {
    assert.strictEqual(zeroOffset(4, 4), null)
  })
})

describe("signedColor", () => {
  it("a loss", () => {
    assert.strictEqual(signedColor(-0.01, COLORS), "red")
  })

  it("zero", () => {
    assert.strictEqual(signedColor(0, COLORS), "blue")
  })

  it("a profit", () => {
    assert.strictEqual(signedColor(12, COLORS), "blue")
  })
})

describe("signedPaint", () => {
  it("crossing zero: both shapes split at zero", () => {
    assert.deepStrictEqual(signedPaint("pnl", [0, -10, 30], COLORS), {
      line: "url(#pnl-line)",
      area: "url(#pnl-area)",
      gradients: [
        {
          id: "pnl-line",
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
          stops: [
            { offset: 0, color: "blue" },
            { offset: 0.75, color: "blue" },
            { offset: 0.75, color: "red" },
            { offset: 1, color: "red" }
          ]
        },
        {
          id: "pnl-area",
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
          stops: [
            { offset: 0, color: "blue", opacity: 0.16 },
            { offset: 0.75, color: "blue", opacity: 0.02 },
            { offset: 0.75, color: "red", opacity: 0.02 },
            { offset: 1, color: "red", opacity: 0.16 }
          ]
        }
      ]
    })
  })

  it("crossing zero many times: one split, where zero is", () => {
    const paint = signedPaint("pnl", [10, -5, 20, -20, 30, -10], COLORS)
    assert.deepStrictEqual(paint.gradients.map((gradient) => gradient.stops.map((stop) => stop.offset)), [
      [0, 0.6, 0.6, 1],
      [0, 0.6, 0.6, 1]
    ])
  })

  it("above zero: the line has its line's box, the area reaches down to zero", () => {
    const paint = signedPaint("pnl", [10, 30], COLORS)
    assert.deepStrictEqual(paint.gradients.map((gradient) => gradient.stops), [
      [{ offset: 0, color: "blue" }, { offset: 1, color: "blue" }],
      [{ offset: 0, color: "blue", opacity: 0.16 }, { offset: 1, color: "blue", opacity: 0.02 }]
    ])
  })

  it("below zero: all loss", () => {
    const paint = signedPaint("pnl", [-10, -30], COLORS)
    assert.deepStrictEqual(paint.gradients.map((gradient) => gradient.stops), [
      [{ offset: 0, color: "red" }, { offset: 1, color: "red" }],
      [{ offset: 0, color: "red", opacity: 0.02 }, { offset: 1, color: "red", opacity: 0.16 }]
    ])
  })

  it("flat below zero: a solid red line, the area still split", () => {
    const paint = signedPaint("pnl", [-4, -4], COLORS)
    assert.deepStrictEqual(
      { line: paint.line, area: paint.area, ids: paint.gradients.map((gradient) => gradient.id) },
      { line: "red", area: "url(#pnl-area)", ids: ["pnl-area"] }
    )
  })

  it("flat at zero: a solid blue line and no fill", () => {
    assert.deepStrictEqual(signedPaint("pnl", [0, 0, 0], COLORS), { line: "blue", area: "none", gradients: [] })
  })
})
