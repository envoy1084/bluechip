import { Costs } from "@bluechip/domain/performance/Performance"
import { assert, describe, it } from "@effect/vitest"
import { costsSentence, gasEth, returnPercent } from "../../../src/lib/performance.ts"

describe("gasEth", () => {
  it.each([
    { wei: 0n, expected: "No gas" },
    { wei: 1_767_794_077_008_414n, expected: "0.001768 ETH" },
    { wei: 1_000_000_000_000_000_000n, expected: "1 ETH" }
  ])("$wei wei is $expected", ({ expected, wei }) => {
    assert.strictEqual(gasEth(wei), expected)
  })
})

describe("costsSentence", () => {
  it.each([
    {
      name: "fees, slippage and gas",
      costs: new Costs({ fees: 50_000n, slippage: 36_230n, gasWei: 1_767_794_077_008_414n }),
      expected: "$0.05 in pool fees, $0.04 of slippage and 0.001768 ETH of gas"
    },
    {
      name: "slippage that beat Chainlink",
      costs: new Costs({ fees: 50_000n, slippage: -36_246n, gasWei: 0n }),
      expected: "$0.05 in pool fees, $0.04 better than Chainlink and no gas"
    },
    {
      name: "nothing at all",
      costs: new Costs({ fees: 0n, slippage: 0n, gasWei: 0n }),
      expected: "$0.00 in pool fees, $0.00 of slippage and no gas"
    }
  ])("$name", ({ costs, expected }) => {
    assert.strictEqual(costsSentence(costs), expected)
  })
})

describe("returnPercent", () => {
  it.each([
    { name: "a gain", profit: 5_000_000n, cost: 100_000_000n, expected: 5 },
    { name: "a loss", profit: -25_000_000n, cost: 100_000_000n, expected: -25 },
    { name: "nothing paid", profit: 5_000_000n, cost: 0n, expected: null }
  ])("$name", ({ cost, expected, profit }) => {
    assert.strictEqual(returnPercent(profit, cost), expected)
  })
})
