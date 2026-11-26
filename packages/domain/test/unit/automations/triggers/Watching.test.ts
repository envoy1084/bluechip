import { EMPTY_STATE, type PriceTick, type WatchState } from "@bluechip/domain/automations/Trigger"
import { stepDrift } from "@bluechip/domain/automations/triggers/Drift"
import { matchesNews, type NewsConfig } from "@bluechip/domain/automations/triggers/News"
import { type PortfolioLevelConfig, stepPortfolioLevel } from "@bluechip/domain/automations/triggers/PortfolioLevel"
import { type PriceCrossConfig, stepPriceCross } from "@bluechip/domain/automations/triggers/PriceCross"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { price } from "../../../fixtures/Automations.ts"

const AT = "2026-11-30T15:00:00Z"

const tick = (dollars: number): PriceTick => ({ price: price(dollars), previousClose: null, day: "2026-11-30", at: AT })

// $1,000: `cash` dollars in cash, the rest in NVIDIA.
const portfolio = (cash: number) =>
  ({
    value: Usdc.make(1_000_000_000n),
    cash: Usdc.make(BigInt(cash) * 1_000_000n),
    holdings: [{ symbol: "NVDA", value: Usdc.make(BigInt(1000 - cash) * 1_000_000n) }]
  }) as never

describe("stepPriceCross", () => {
  const above: PriceCrossConfig = { symbol: "AAPL", level: price(250), direction: "above" }

  it.each<{ name: string; state: WatchState; tick: PriceTick; expected: unknown }>([
    {
      name: "a first tick under the level",
      state: EMPTY_STATE,
      tick: tick(240),
      expected: { state: { ...EMPTY_STATE, side: "below" }, fire: null }
    },
    {
      name: "a first tick already over the level fires nothing",
      state: EMPTY_STATE,
      tick: tick(260),
      expected: { state: { ...EMPTY_STATE, side: "above" }, fire: null }
    },
    {
      name: "crossing from under to over fires",
      state: { ...EMPTY_STATE, side: "below" },
      tick: tick(251),
      expected: { state: { ...EMPTY_STATE, side: "above", lastWindow: `cross:above:${AT}` }, fire: `cross:above:${AT}` }
    },
    {
      name: "exactly at the level keeps the side",
      state: { ...EMPTY_STATE, side: "below" },
      tick: tick(250),
      expected: { state: { ...EMPTY_STATE, side: "below" }, fire: null }
    },
    {
      name: "crossing down fires nothing for an upward cross",
      state: { ...EMPTY_STATE, side: "above" },
      tick: tick(240),
      expected: { state: { ...EMPTY_STATE, side: "below" }, fire: null }
    }
  ])("$name", ({ expected, state, tick }) => {
    assert.deepStrictEqual(stepPriceCross(above, state, tick), expected)
  })
})

describe("stepDrift", () => {
  // 50% NVIDIA, 50% cash, rebalancing past 5% (band 1%).
  const config = {
    targets: [{ asset: "NVDA" as const, weight: 5000 }, { asset: "USDC" as const, weight: 5000 }],
    triggerBps: 500
  }

  it.each<{ name: string; state: WatchState; cash: number; expected: unknown }>([
    {
      name: "4.9% off target fires nothing",
      state: EMPTY_STATE,
      cash: 451,
      expected: { state: EMPTY_STATE, fire: null }
    },
    {
      name: "5% off target fires",
      state: EMPTY_STATE,
      cash: 450,
      expected: { state: { ...EMPTY_STATE, side: "above", lastWindow: `drift:${AT}` }, fire: `drift:${AT}` }
    },
    {
      name: "still off target after firing fires nothing",
      state: { ...EMPTY_STATE, side: "above" },
      cash: 400,
      expected: { state: { ...EMPTY_STATE, side: "above" }, fire: null }
    },
    {
      name: "back within the 1% band arms it again",
      state: { ...EMPTY_STATE, side: "above" },
      cash: 495,
      expected: { state: { ...EMPTY_STATE, side: "below" }, fire: null }
    },
    {
      name: "between the band and the trigger keeps it as it was",
      state: { ...EMPTY_STATE, side: "above" },
      cash: 480,
      expected: { state: { ...EMPTY_STATE, side: "above" }, fire: null }
    }
  ])("$name", ({ cash, expected, state }) => {
    assert.deepStrictEqual(stepDrift(config, state, portfolio(cash), AT), expected)
  })
})

describe("stepPortfolioLevel", () => {
  const cashUnder10: PortfolioLevelConfig = { measure: "cash", symbol: null, direction: "below", bps: 1000 }
  const nvidiaOver40: PortfolioLevelConfig = { measure: "holding", symbol: "NVDA", direction: "above", bps: 4000 }

  it.each<{ name: string; config: PortfolioLevelConfig; state: WatchState; cash: number; expected: unknown }>([
    {
      name: "cash at 10% fires nothing",
      config: cashUnder10,
      state: EMPTY_STATE,
      cash: 100,
      expected: { state: { ...EMPTY_STATE, side: "above" }, fire: null }
    },
    {
      name: "cash under 10% fires",
      config: cashUnder10,
      state: { ...EMPTY_STATE, side: "above" },
      cash: 99,
      expected: { state: { ...EMPTY_STATE, side: "below", lastWindow: `portfolio:${AT}` }, fire: `portfolio:${AT}` }
    },
    {
      name: "cash still under 10% fires nothing more",
      config: cashUnder10,
      state: { ...EMPTY_STATE, side: "below" },
      cash: 50,
      expected: { state: { ...EMPTY_STATE, side: "below" }, fire: null }
    },
    {
      name: "NVIDIA over 40% fires",
      config: nvidiaOver40,
      state: EMPTY_STATE,
      cash: 590,
      expected: { state: { ...EMPTY_STATE, side: "above", lastWindow: `portfolio:${AT}` }, fire: `portfolio:${AT}` }
    }
  ])("$name", ({ cash, config, expected, state }) => {
    assert.deepStrictEqual(stepPortfolioLevel(config, state, portfolio(cash), AT), expected)
  })
})

describe("matchesNews", () => {
  const config: NewsConfig = { symbols: ["NVDA"], topics: ["export controls"] }

  it.each([
    {
      name: "a story about NVIDIA",
      story: { symbols: ["NVDA", "AMD"], headline: "Chips rally", summary: "" },
      expected: true
    },
    {
      name: "a story mentioning a topic, in other case",
      story: { symbols: ["INTC"], headline: "New Export Controls", summary: "" },
      expected: true
    },
    {
      name: "a topic in the summary",
      story: { symbols: [], headline: "Policy", summary: "Talks on export controls stall" },
      expected: true
    },
    {
      name: "a story about neither",
      story: { symbols: ["TSLA"], headline: "Tesla deliveries", summary: "" },
      expected: false
    }
  ])("$name", ({ expected, story }) => {
    assert.strictEqual(matchesNews(config, story), expected)
  })
})
