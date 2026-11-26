import { Address } from "@bluechip/domain/Ids"
import { MarketPrice, Stock } from "@bluechip/domain/market/Market"
import { Bps, Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { Holding } from "@bluechip/domain/portfolio/Portfolio"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { holdingFacts } from "../../../../../src/features/stocks/model/holding.ts"
import { agent } from "../../../../fixtures/Agents.ts"

const NVIDIA = new Stock({
  symbol: "NVDA",
  name: "Nvidia",
  token: Address.make("0x0000000000000000000000000000000000000001"),
  tradable: true,
  logoUrl: null,
  price: new MarketPrice({
    symbol: "NVDA",
    price: Price.make(15_000_000_000n),
    tradedAt: DateTime.makeUnsafe("2026-11-26T15:00:00Z"),
    previousClose: Price.make(14_700_000_000n)
  }),
  reference: null,
  change24h: Bps.make(204)
})

const HOLDING = new Holding({
  symbol: "NVDA",
  shares: Shares.make(250_000_000n),
  price: null,
  value: Usdc.make(375_000_000n),
  weightBps: Bps.make(3750),
  change24h: null
})

describe("holdingFacts", () => {
  it("2.5 shares at the live price, traded by one running agent and its 30% cap", () => {
    assert.deepStrictEqual(holdingFacts(HOLDING, NVIDIA, [agent("active")]), {
      symbol: "NVDA",
      name: "Nvidia",
      shares: 2.5,
      price: 150,
      dayChangePercent: 2.04,
      weight: 37.5,
      cap: 30,
      agents: [{ id: "agent_01jd8v4t5m6n7a8q9r0s1t2v3w", name: "Nvidia picker" }]
    })
  })

  it.each(
    [
      { name: "a draft agent doesn't trade it", status: "draft" },
      { name: "a removed agent doesn't trade it", status: "removed" }
    ] as const
  )("$name", ({ status }) => {
    const facts = holdingFacts(HOLDING, NVIDIA, [agent(status)])

    assert.deepStrictEqual([facts?.agents, facts?.cap], [[], undefined])
  })

  it("no price anywhere: nothing to show", () => {
    assert.isNull(holdingFacts(HOLDING, new Stock({ ...NVIDIA, price: null }), []))
  })

  it("no shares: nothing to show", () => {
    assert.isNull(holdingFacts(new Holding({ ...HOLDING, shares: Shares.make(0n) }), NVIDIA, []))
  })
})
