/**
 * An action: what an automation does when it fires and its conditions hold. Trading actions plan legs from the
 * portfolio and prices; the agent's onchain policies still decide each one.
 *
 * @since 0.0.0
 */
import type * as Schema from "effect/Schema"
import type { Leg } from "../intents/Intent.ts"
import type { StockSymbol } from "../market/Market.ts"
import type { Price } from "../market/Units.ts"
import type { AgentSpec } from "../policies/AgentSpec.ts"
import type { Portfolio } from "../portfolio/Portfolio.ts"
import * as Entry from "./Entry.ts"

/**
 * What a plan reads: the portfolio at market prices, each stock's price, and the agent's policies (`null` for your
 * own trades).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface PlanContext {
  readonly portfolio: Pick<Portfolio, "value" | "holdings">
  readonly prices: ReadonlyMap<StockSymbol, Price>
  readonly spec: AgentSpec | null
}

/**
 * An action. `plan` gives the trades it wants, before they are split to fit the agent's largest trade; `null` for an
 * action that trades nothing (`notify`).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface ActionType<Type extends string = string, S extends Schema.Top = Schema.Top>
  extends Entry.EntryType<Type, S>
{
  readonly plan: ((config: S["Type"], context: PlanContext) => ReadonlyArray<Leg>) | null
}

/**
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const make = <const Type extends string, S extends Schema.Top>(
  options: Entry.EntryOptions<Type, S> & { readonly plan: ActionType<Type, S>["plan"] }
): ActionType<Type, S> => ({ ...options, ...Entry.make(options) })
