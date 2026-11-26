/**
 * The `priceMove` trigger: a stock moves a percentage from a reference, its previous close, the day's first price,
 * its highest (or, rising, lowest) price since the automation was set up, or its price then. Each reference has its
 * own window: a day for the close and the day's first price, each new high for a trailing high, once for the price
 * at setup.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../../market/Market.ts"
import type { Price } from "../../market/Units.ts"
import { stockProblems } from "../AgentLimits.ts"
import { Field } from "../Entry.ts"
import { formatBps } from "../Format.ts"
import * as Trigger from "../Trigger.ts"

/**
 * What the move is measured from.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Reference = Schema.Literals(["previousClose", "open", "trailingHigh", "price"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Reference = typeof Reference.Type

/**
 * The stock, the reference, how far it moves (basis points) and which way.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PriceMoveConfig = Schema.Struct({
  symbol: StockSymbol,
  reference: Reference,
  bps: Schema.Int,
  direction: Schema.Literals(["down", "up"])
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PriceMoveConfig = typeof PriceMoveConfig.Type

const FROM: Readonly<Record<PriceMoveConfig["direction"], Readonly<Record<Reference, string>>>> = {
  down: {
    previousClose: "its previous close",
    open: "today's first price",
    trailingHigh: "its high",
    price: "its price when you set this up"
  },
  up: {
    previousClose: "its previous close",
    open: "today's first price",
    trailingHigh: "its low",
    price: "its price when you set this up"
  }
}

/**
 * @stability unstable
 * @category triggers
 * @since 0.0.0
 */
export const priceMove = Trigger.make({
  type: "priceMove",
  watcher: "price",
  marketHours: true,
  asks: false,
  title: "Price move",
  summary: "When a stock rises or falls a percentage from its close, its high or another reference.",
  aliases: ["stop loss", "drops", "falls", "rises", "jumps", "trailing stop", "dip"],
  examples: ["If NVIDIA falls 10% from its high, sell half", "When Apple drops 5% in a day, buy $100"],
  config: PriceMoveConfig,
  fields: {
    symbol: new Field({ label: "Stock", unit: "stock" }),
    reference: new Field({ label: "From", unit: "choice" }),
    bps: new Field({ label: "By", unit: "bps", min: 100, max: 5000, step: 100, choices: [500, 1000, 2000] }),
    direction: new Field({ label: "Direction", unit: "choice" })
  },
  defaults: { symbol: "NVDA", reference: "trailingHigh", bps: 1000, direction: "down" },
  check: (config, context) => stockProblems("symbol", [config.symbol], context),
  describe: (config, { name }) =>
    `when ${name(config.symbol)} ${config.direction === "down" ? "falls" : "rises"} ${formatBps(config.bps)} from ` +
    FROM[config.direction][config.reference]
})

const BPS = BigInt(10_000)

const moved = (config: PriceMoveConfig, price: Price, reference: Price): boolean =>
  config.direction === "down" ?
    price * BPS <= reference * (BPS - BigInt(config.bps)) :
    price * BPS >= reference * (BPS + BigInt(config.bps))

/**
 * What a tick does to a `priceMove` automation: the references it keeps (the extreme, the day's first price, the
 * price at setup) and the window it fires, once.
 *
 * **Example** (NVIDIA 10% under its $100 high)
 *
 * ```ts import.meta.vitest
 * import { EMPTY_STATE } from "@bluechip/domain/automations/Trigger"
 * import { stepPriceMove } from "@bluechip/domain/automations/triggers/PriceMove"
 *
 * const config = { symbol: "NVDA", reference: "trailingHigh", bps: 1000, direction: "down" } as const
 * const state = { ...EMPTY_STATE, extreme: 10_000_000_000n } as never
 * stepPriceMove(config, state, { price: 9_000_000_000n, previousClose: null, day: "2026-11-30", at: "" } as never).fire
 * // => "high:10000000000"
 * ```
 *
 * @stability unstable
 * @category watching
 * @since 0.0.0
 */
export const stepPriceMove = (
  config: PriceMoveConfig,
  state: Trigger.WatchState,
  tick: Trigger.PriceTick
): Trigger.Step => {
  const rising = config.direction === "up"
  switch (config.reference) {
    case "previousClose": {
      if (tick.previousClose === null || !moved(config, tick.price, tick.previousClose)) return { state, fire: null }
      return Trigger.fireOnce(state, `close:${tick.day}`)
    }
    case "open": {
      const open = state.open?.day === tick.day ? state.open : { day: tick.day, price: tick.price }
      const next = { ...state, open }
      return moved(config, tick.price, open.price)
        ? Trigger.fireOnce(next, `open:${tick.day}`)
        : { state: next, fire: null }
    }
    case "trailingHigh": {
      const extreme = state.extreme === null ?
        tick.price :
        (rising ? tick.price < state.extreme : tick.price > state.extreme) ?
        tick.price :
        state.extreme
      const next = { ...state, extreme }
      return moved(config, tick.price, extreme) ?
        Trigger.fireOnce(next, `${rising ? "low" : "high"}:${extreme}`) :
        { state: next, fire: null }
    }
    case "price": {
      const base = state.base ?? tick.price
      const next = { ...state, base }
      return moved(config, tick.price, base) ? Trigger.fireOnce(next, `base:${base}`) : { state: next, fire: null }
    }
  }
}
