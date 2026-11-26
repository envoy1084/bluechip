/**
 * A trigger: when an automation fires. Each type is served by one watcher in the server (the schedule, prices, the
 * portfolio or the news), which finds the automations due and the window a fire belongs to, so each window fires
 * once.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Price } from "../market/Units.ts"
import * as Entry from "./Entry.ts"

/**
 * Which watcher serves a trigger: due times read from the database, the price stream, the portfolio (prices and
 * fills), or the news.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Watcher = "schedule" | "price" | "portfolio" | "news"

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface TriggerType<Type extends string = string, S extends Schema.Top = Schema.Top>
  extends Entry.EntryType<Type, S>
{
  readonly watcher: Watcher
  /** Fires only while the market is open unless the automation's settings say otherwise. */
  readonly marketHours: boolean
  /** The trades it leads to wait for your approval unless the automation's settings let it act directly. */
  readonly asks: boolean
}

/**
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const make = <const Type extends string, S extends Schema.Top>(
  options: Entry.EntryOptions<Type, S> & {
    readonly watcher: Watcher
    readonly marketHours: boolean
    readonly asks: boolean
  }
): TriggerType<Type, S> => ({ ...options, ...Entry.make(options) })

/**
 * What a watcher remembers of an automation between ticks, stored with it: the highest (or lowest) price seen, the
 * day's first price, the price when it was set up, which side of a level or threshold the last tick was on, and the
 * last window it fired, so a window fires once.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const WatchState = Schema.Struct({
  extreme: Schema.NullOr(Price),
  open: Schema.NullOr(Schema.Struct({ day: Schema.String, price: Price })),
  base: Schema.NullOr(Price),
  side: Schema.NullOr(Schema.Literals(["above", "below"])),
  lastWindow: Schema.NullOr(Schema.String)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type WatchState = typeof WatchState.Type

/**
 * A state that has seen nothing yet.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const EMPTY_STATE: WatchState = { extreme: null, open: null, base: null, side: null, lastWindow: null }

/**
 * What a tick decided: the state to keep, and the window to fire (`null`: nothing to fire).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Step {
  readonly state: WatchState
  readonly fire: string | null
}

/**
 * Fires `window` unless it is the one fired last.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const fireOnce = (state: WatchState, window: string): Step =>
  state.lastWindow === window ? { state, fire: null } : { state: { ...state, lastWindow: window }, fire: window }

/**
 * A stock's market price as a price watcher sees it: the price, the previous session's close, the New York day it
 * traded on, and when the watcher saw it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface PriceTick {
  readonly price: Price
  readonly previousClose: Price | null
  readonly day: string
  readonly at: string
}

/**
 * Whether two states are the same, so a watcher saves only a state that changed.
 *
 * @stability unstable
 * @category equivalence
 * @since 0.0.0
 */
export const sameState = Schema.toEquivalence(WatchState)
