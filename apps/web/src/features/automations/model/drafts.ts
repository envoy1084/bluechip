// An automation as its editor holds it, and every change the editor makes to it: picking a trigger, a condition or
// an action starts it from the catalog's defaults, on the stocks this automation is about.
import { TRADE_ACTIONS } from "@bluechip/domain/automations/actions/Ask"
import {
  type Action,
  ACTIONS,
  type Automation,
  AutomationDraft,
  type Condition,
  CONDITIONS,
  type Trigger,
  TRIGGERS
} from "@bluechip/domain/automations/Automation"
import type { CheckContext, EntryType, Field } from "@bluechip/domain/automations/Entry"
import type { Settings } from "@bluechip/domain/automations/Settings"
import type { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"

/** Any entry of a catalog, read through its field hints. */
export type CatalogEntry = EntryType<string, never>

/** A stored entry: `{ type, config }`. */
export interface Entry {
  readonly type: string
  readonly config: unknown
}

export type Kind = "trigger" | "condition" | "action"

const CATALOG: Readonly<Record<Kind, ReadonlyArray<CatalogEntry>>> = {
  trigger: TRIGGERS as unknown as ReadonlyArray<CatalogEntry>,
  condition: CONDITIONS as unknown as ReadonlyArray<CatalogEntry>,
  action: ACTIONS as unknown as ReadonlyArray<CatalogEntry>
}

/** The automation being edited: like a draft, but its name may still be empty. */
export interface DraftFields {
  readonly name: string
  readonly agentId: AgentId | null
  readonly trigger: Trigger
  readonly conditions: ReadonlyArray<Condition>
  readonly action: Action
  readonly settings: Settings
}

/** The catalog entry of a stored one. */
export const catalogEntry = (kind: Kind, type: string): CatalogEntry =>
  CATALOG[kind].find((entry) => entry.type === type)!

/** Each field of an entry with its hint, in the catalog's order. */
export const fieldsOf = (entry: CatalogEntry): ReadonlyArray<readonly [string, Field]> =>
  Object.entries(entry.fields as Record<string, Field>)

/** The choices of a `choice` field, from the literals of its configuration schema. */
export const choicesOf = (entry: CatalogEntry, field: string): ReadonlyArray<string> => {
  const schema = (entry.config as unknown as { readonly fields: Record<string, unknown> }).fields[field]
  const literals = (schema as { readonly literals?: ReadonlyArray<unknown> } | undefined)?.literals ?? []
  return literals.filter((literal): literal is string => typeof literal === "string")
}

/** Weights for an even split across `symbols`, adding up to 10,000 basis points (the last takes what's left). */
export const evenSplit = (symbols: ReadonlyArray<StockSymbol>) => {
  const each = Math.floor(10_000 / Math.max(symbols.length, 1))
  return symbols.map((symbol, index) => ({
    symbol,
    weight: index === symbols.length - 1 ? 10_000 - each * (symbols.length - 1) : each
  }))
}

/**
 * The catalog's defaults for `entry`, about `stock` instead of the catalog's example stock: every stock field, the
 * stocks of a list or a split, and the trade an `ask` proposes (the catalog's sale, or with `context` the first trade
 * the automation may make when it may not sell: a buy for an agent that only buys).
 */
export const freshEntry = (kind: Kind, type: string, stock: StockSymbol, context?: CheckContext): Entry => {
  const entry = catalogEntry(kind, type)
  const config: Record<string, unknown> = { ...(entry.defaults as Record<string, unknown>) }

  for (const [name, field] of fieldsOf(entry)) {
    if (field.unit === "stock" && config[name] !== null) config[name] = stock
    if (field.unit === "stocks") config[name] = [stock]
    if (field.unit === "split") config[name] = evenSplit([stock])
    if (field.unit === "action") {
      const catalogs = (config[name] as Entry).type
      const trades = context === undefined ? [] : offeredTrades(context).map((trade) => trade.type)
      const trade = trades.length === 0 || trades.includes(catalogs) ? catalogs : trades[0]!
      config[name] = freshEntry("action", trade, stock)
    }
  }
  return { type, config }
}

const TRADES = TRADE_ACTIONS as unknown as ReadonlyArray<CatalogEntry>

/** The trades an `ask` of this automation can propose: those its agent may make when it asks you first. */
export const offeredTrades = (context: CheckContext): ReadonlyArray<CatalogEntry> =>
  TRADES.filter((entry) => whyUnavailable(entry, { ...context, asking: true }) === null)

/**
 * Why an entry can't run for this automation at all, whatever its fields (an agent that only buys never sells; only
 * an agent with a target mix watches drift), or `null` when it can. `ask` can while there is a trade it can propose.
 */
export const whyUnavailable = (entry: CatalogEntry, context: CheckContext): string | null => {
  if (entry.type === "ask") return offeredTrades(context).length > 0 ? null : "There's no trade it could ask you about."
  return entry.check(entry.defaults as never, context).find((problem) => problem.field === null)?.message ?? null
}

/** The entries of a catalog that can run for this automation. Fields can still be wrong. */
export const offered = (kind: Kind, context: CheckContext): ReadonlyArray<CatalogEntry> =>
  CATALOG[kind].filter((entry) => whyUnavailable(entry, context) === null)

/** Every entry of a catalog, in its order. */
export const catalogOf = (kind: Kind): ReadonlyArray<CatalogEntry> => CATALOG[kind]

/** The entry with one field changed. */
export const withField = <E extends Entry>(entry: E, name: string, value: unknown): E => ({
  ...entry,
  config: { ...(entry.config as Record<string, unknown>), [name]: value }
})

/** A name from what it does, while you haven't named it: "Buy $50 of Apple". */
export const suggestedName = (action: string): string => {
  const named = action.length === 0 ? "My automation" : action[0]!.toUpperCase() + action.slice(1)
  return named.length <= 60 ? named : `${named.slice(0, 59).trimEnd()}…`
}

/**
 * The draft as bluechip checks and saves it, named from what it does while its name is empty. Range checks are left
 * to `checkAutomation`, which says them as problems instead of throwing.
 */
export const toDraft = (fields: DraftFields, action: string): AutomationDraft =>
  new AutomationDraft({ ...fields, name: fields.name.trim() || suggestedName(action) }, { disableChecks: true })

/** A saved automation as the editor holds it. */
export const draftFieldsOf = (
  automation: Pick<Automation, "name" | "agentId" | "trigger" | "conditions" | "action" | "settings">
): DraftFields => ({
  name: automation.name,
  agentId: automation.agentId,
  trigger: automation.trigger,
  conditions: automation.conditions,
  action: automation.action,
  settings: automation.settings
})

/**
 * What a new automation starts as: every Monday at 10:00 (or the catalog's defaults for `trigger`), buying $50 of the
 * first stock it may trade.
 */
export const newDraft = (
  agentId: AgentId | null,
  stock: StockSymbol,
  settings: Settings,
  trigger: Trigger["type"] = "schedule"
): DraftFields => ({
  name: "",
  agentId,
  trigger: freshEntry("trigger", trigger, stock) as Trigger,
  conditions: [],
  action: freshEntry("action", "buy", stock) as Action,
  settings
})

/** The stocks an automation for `spec` picks from: the agent's, or every stock for your own. */
export const stocksFor = (
  spec: AgentSpec | null,
  all: ReadonlyArray<StockSymbol>
): ReadonlyArray<StockSymbol> => {
  const stocks = spec === null ? [] : configOf(spec.policies, trade)?.stocks ?? []
  return stocks.length === 0 ? all : stocks
}

/**
 * The entry with one field changed, and what the change brings with it: a portfolio trigger on cash has no stock, and
 * one on a holding needs one.
 */
export const changeField = (entry: Entry, name: string, value: unknown, stock: StockSymbol): Entry => {
  const next = withField(entry, name, value)
  if (entry.type !== "portfolio" || name !== "measure") return next
  const symbol = (entry.config as { readonly symbol: StockSymbol | null }).symbol
  return withField(next, "symbol", value === "cash" ? null : symbol ?? stock)
}
