import { assert, describe, it } from "@effect/vitest"
import { editorTargets, fromEditor } from "../../../../../src/features/agents/model/mix.ts"

describe("editorTargets", () => {
  it("each stock's weight in whole percents, cash left out", () => {
    assert.deepStrictEqual(
      editorTargets(["NVDA", "AAPL"], [{ asset: "NVDA", weight: 3000 }, { asset: "AAPL", weight: 2000 }, {
        asset: "USDC",
        weight: 5000
      }]),
      [{ symbol: "NVDA", target: 30 }, { symbol: "AAPL", target: 20 }]
    )
  })

  it("a stock without a target: 0%", () => {
    assert.deepStrictEqual(editorTargets(["MSFT"], [{ asset: "USDC", weight: 10_000 }]), [{
      symbol: "MSFT",
      target: 0
    }])
  })

  it("a weight between percents rounds to the nearest", () => {
    assert.deepStrictEqual(editorTargets(["NVDA"], [{ asset: "NVDA", weight: 3350 }]), [{ symbol: "NVDA", target: 34 }])
  })

  it("a target for a stock it no longer trades is dropped", () => {
    assert.deepStrictEqual(editorTargets([], [{ asset: "NVDA", weight: 3000 }]), [])
  })
})

describe("fromEditor", () => {
  it("rows as basis points, cash taking the rest", () => {
    assert.deepStrictEqual(fromEditor([{ symbol: "NVDA", target: 30 }, { symbol: "AAPL", target: 25 }]), [
      { asset: "NVDA", weight: 3000 },
      { asset: "AAPL", weight: 2500 },
      { asset: "USDC", weight: 4500 }
    ])
  })

  it("no rows: all cash", () => {
    assert.deepStrictEqual(fromEditor([]), [{ asset: "USDC", weight: 10_000 }])
  })

  it("a row that isn't a stock is left out", () => {
    assert.deepStrictEqual(fromEditor([{ symbol: "cash", target: 40 }, { symbol: "NVDA", target: 60 }]), [
      { asset: "NVDA", weight: 6000 },
      { asset: "USDC", weight: 4000 }
    ])
  })
})
