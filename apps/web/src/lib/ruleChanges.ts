// How an agent's rules change, rule by rule, as before → after: the fields that differ in each changed policy, in the
// words a card shows them ("Daily budget: $250 → $100", "Stocks: Nvidia → Nvidia and Apple").
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { policyOf, type SpecChanges } from "@bluechip/domain/policies/Catalog"
import { formatDollars, formatPercent, formatPrice, listNames } from "@bluechip/domain/policies/Format"
import type { Field } from "@bluechip/domain/policies/Policy"
import type { Target } from "@bluechip/domain/policies/Rebalance"
import type { Floor } from "@bluechip/domain/policies/StopLossFloor"
import type { Direction } from "@bluechip/domain/policies/Trade"

const DIRECTION: Readonly<Record<Direction, string>> = {
  both: "Buy and sell",
  buy: "Buy only",
  sell: "Sell only",
  rebalance: "Rebalance only"
}

type NameOf = (symbol: StockSymbol) => string

/** One field's value as a card says it, from its unit: "$250", "30%", "Nvidia and Apple", "Buy only". */
export const fieldValueText = (field: Field, value: unknown, nameOf: NameOf): string => {
  switch (field.unit) {
    case "usd":
      return formatDollars(value as bigint)
    case "bps":
      return formatPercent(value as number)
    case "count":
      return String(value)
    case "toggle":
      return value === true ? "On" : "Off"
    case "stocks":
      return listNames((value as ReadonlyArray<StockSymbol>).map(nameOf))
    case "direction":
      return DIRECTION[value as Direction]
    case "mix":
      return listNames(
        (value as ReadonlyArray<Target>).map((target) =>
          `${target.asset === "USDC" ? "cash" : nameOf(target.asset)} ${formatPercent(target.weight)}`
        )
      )
    case "floors":
      return listNames(
        (value as ReadonlyArray<Floor>).map((floor) => `${nameOf(floor.symbol)} at ${formatPrice(floor.price)}`)
      )
    case "wei":
      return `${Number(value as bigint) / 1e9} gwei`
  }
}

/** A field that changed: what it was and what it becomes (`null` when the rule is new or goes). */
export interface FieldChange {
  readonly label: string
  readonly before: string | null
  readonly after: string | null
}

export interface RuleChangeRow {
  readonly title: string
  readonly change: SpecChanges["policies"][number]["change"]
  readonly fields: ReadonlyArray<FieldChange>
}

const configIn = (spec: AgentSpec, id: string): Readonly<Record<string, unknown>> | undefined =>
  spec.policies.find((entry) => entry.id === id)?.config as Readonly<Record<string, unknown>> | undefined

/** `changes` (from `compareSpecs(before, after)`) with each visible rule's changed fields, before and after. */
export const ruleChanges = (
  before: AgentSpec,
  after: AgentSpec,
  changes: SpecChanges,
  nameOf: NameOf
): ReadonlyArray<RuleChangeRow> =>
  changes.policies.flatMap(({ change, policy: id }) => {
    const policy = policyOf(id)
    if (policy.hidden) return []

    const old = configIn(before, id)
    const next = configIn(after, id)
    const fields = Object.entries(policy.fields as Readonly<Record<string, Field>>).flatMap(([name, field]) => {
      const was = old === undefined ? null : fieldValueText(field, old[name], nameOf)
      const becomes = next === undefined ? null : fieldValueText(field, next[name], nameOf)
      return was === becomes ? [] : [{ label: field.label, before: was, after: becomes }]
    })
    return [{ title: policy.title, change, fields }]
  })
