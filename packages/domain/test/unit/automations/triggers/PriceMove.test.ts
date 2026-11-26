import { EMPTY_STATE, type PriceTick, type WatchState } from "@bluechip/domain/automations/Trigger"
import { type PriceMoveConfig, stepPriceMove } from "@bluechip/domain/automations/triggers/PriceMove"
import { assert, describe, it } from "@effect/vitest"
import { price } from "../../../fixtures/Automations.ts"

const tick = (dollars: number, previousClose: number | null = null, day = "2026-11-30"): PriceTick => ({
  price: price(dollars),
  previousClose: previousClose === null ? null : price(previousClose),
  day,
  at: `${day}T15:00:00Z`
})

const falls = (reference: PriceMoveConfig["reference"]): PriceMoveConfig => ({
  symbol: "NVDA",
  reference,
  bps: 1000,
  direction: "down"
})

describe("stepPriceMove", () => {
  it.each<{ name: string; config: PriceMoveConfig; state: WatchState; tick: PriceTick; expected: unknown }>([
    {
      name: "a first tick sets the high and fires nothing",
      config: falls("trailingHigh"),
      state: EMPTY_STATE,
      tick: tick(100),
      expected: { state: { ...EMPTY_STATE, extreme: price(100) }, fire: null }
    },
    {
      name: "a higher price raises the high",
      config: falls("trailingHigh"),
      state: { ...EMPTY_STATE, extreme: price(100) },
      tick: tick(110),
      expected: { state: { ...EMPTY_STATE, extreme: price(110) }, fire: null }
    },
    {
      name: "9.99% under the high fires nothing",
      config: falls("trailingHigh"),
      state: { ...EMPTY_STATE, extreme: price(100) },
      tick: tick(90.01),
      expected: { state: { ...EMPTY_STATE, extreme: price(100) }, fire: null }
    },
    {
      name: "10% under the high fires the high's window",
      config: falls("trailingHigh"),
      state: { ...EMPTY_STATE, extreme: price(100) },
      tick: tick(90),
      expected: {
        state: { ...EMPTY_STATE, extreme: price(100), lastWindow: "high:10000000000" },
        fire: "high:10000000000"
      }
    },
    {
      name: "still under after firing fires nothing more",
      config: falls("trailingHigh"),
      state: { ...EMPTY_STATE, extreme: price(100), lastWindow: "high:10000000000" },
      tick: tick(85),
      expected: { state: { ...EMPTY_STATE, extreme: price(100), lastWindow: "high:10000000000" }, fire: null }
    },
    {
      name: "rising 10% from its low fires the low's window",
      config: { ...falls("trailingHigh"), direction: "up" },
      state: { ...EMPTY_STATE, extreme: price(100) },
      tick: tick(110),
      expected: {
        state: { ...EMPTY_STATE, extreme: price(100), lastWindow: "low:10000000000" },
        fire: "low:10000000000"
      }
    },
    {
      name: "10% under the previous close fires the day's window",
      config: falls("previousClose"),
      state: EMPTY_STATE,
      tick: tick(90, 100),
      expected: { state: { ...EMPTY_STATE, lastWindow: "close:2026-11-30" }, fire: "close:2026-11-30" }
    },
    {
      name: "no previous close fires nothing",
      config: falls("previousClose"),
      state: EMPTY_STATE,
      tick: tick(50),
      expected: { state: EMPTY_STATE, fire: null }
    },
    {
      name: "the day's first price becomes its open",
      config: falls("open"),
      state: { ...EMPTY_STATE, open: { day: "2026-11-27", price: price(80) } },
      tick: tick(100),
      expected: { state: { ...EMPTY_STATE, open: { day: "2026-11-30", price: price(100) } }, fire: null }
    },
    {
      name: "10% under the day's open fires the day's window",
      config: falls("open"),
      state: { ...EMPTY_STATE, open: { day: "2026-11-30", price: price(100) } },
      tick: tick(90),
      expected: {
        state: { ...EMPTY_STATE, open: { day: "2026-11-30", price: price(100) }, lastWindow: "open:2026-11-30" },
        fire: "open:2026-11-30"
      }
    },
    {
      name: "10% under the price at setup fires once",
      config: falls("price"),
      state: { ...EMPTY_STATE, base: price(100) },
      tick: tick(89),
      expected: {
        state: { ...EMPTY_STATE, base: price(100), lastWindow: "base:10000000000" },
        fire: "base:10000000000"
      }
    }
  ])("$name", ({ config, expected, state, tick }) => {
    assert.deepStrictEqual(stepPriceMove(config, state, tick), expected)
  })
})
