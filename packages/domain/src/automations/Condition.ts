/**
 * A condition: what must hold when a trigger fires for the automation to go on. Conditions run in order and stop at
 * the first that fails; each result is recorded with its reason.
 *
 * @since 0.0.0
 */
import type * as DateTime from "effect/DateTime"
import type * as Schema from "effect/Schema"
import type { StockSymbol } from "../market/Market.ts"
import type { Price, Shares } from "../market/Units.ts"
import * as Entry from "./Entry.ts"

/**
 * What the conditions read when a trigger fires: the time, whether the market is open and prices fresh, each
 * stock's market price and what the account holds.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Facts {
  readonly now: DateTime.Utc
  readonly marketOpen: boolean
  readonly pricesFresh: boolean
  readonly prices: ReadonlyMap<StockSymbol, Price>
  readonly holdings: ReadonlyMap<StockSymbol, Shares>
}

/**
 * Whether a condition held, and why, in words.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Result {
  readonly pass: boolean
  readonly reason: string
}

/**
 * A condition decided by code from the facts. `judgment` is the one decided by a model, in the server.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface ConditionType<Type extends string = string, S extends Schema.Top = Schema.Top>
  extends Entry.EntryType<Type, S>
{
  readonly evaluate: ((config: S["Type"], facts: Facts) => Result) | null
}

/**
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const make = <const Type extends string, S extends Schema.Top>(
  options: Entry.EntryOptions<Type, S> & { readonly evaluate: ConditionType<Type, S>["evaluate"] }
): ConditionType<Type, S> => ({ ...options, ...Entry.make(options) })
