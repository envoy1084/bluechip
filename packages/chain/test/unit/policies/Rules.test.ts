import { RULES } from "@bluechip/chain/policies/Rules"
import { assert, describe, it } from "@effect/vitest"
import { decodeAbiParameters } from "viem"
import { changed, PICKER } from "../../fixtures/Specs.ts"

describe("RULES", () => {
  it("stopLossFloor: a floor per stock by the guard's market index, 0 for a stock it doesn't trade", () => {
    const spec = changed(PICKER, { id: "trade", config: { direction: "sell", dailyBudget: BigInt(0) } }, {
      id: "stopLossFloor",
      config: {
        floors: [{ symbol: "NVDA", price: BigInt(15_000_000_000) }, { symbol: "AAPL", price: BigInt(18_050_000_000) }]
      }
    })
    const binding = RULES.find((rule) => rule.policy === "stopLossFloor")!

    const [config] = decodeAbiParameters(
      [{ type: "tuple", components: [{ type: "uint256[]", name: "floors" }] }],
      binding.config(spec)
    )

    // AAPL, AMZN, ANT, CRCL, GOOGL, INTC, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA.
    assert.deepStrictEqual(config.floors, [
      BigInt(18_050_000_000),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(15_000_000_000),
      BigInt(0),
      BigInt(0),
      BigInt(0)
    ])
  })
})
