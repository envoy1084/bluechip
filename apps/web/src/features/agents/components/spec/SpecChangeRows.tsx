import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf, type SpecChanges } from "@bluechip/domain/policies/Catalog"
import { configOf, type Field } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { Icon } from "@bluechip/ui/icons/icon"
import { fieldText } from "../../model/fieldText.ts"
import { type ChangeKind, ChangeMark } from "./ChangeMark.tsx"

type Values = ReadonlyArray<{ readonly label: string; readonly text: string }>

const valuesOf = (spec: AgentSpec, id: PolicyId, nameOf: (symbol: StockSymbol) => string): Values => {
  const config = spec.policies.find((entry) => entry.id === id)?.config as Record<string, unknown> | undefined
  if (config === undefined) return []
  return Object.entries(policyOf(id).fields as Record<string, Field>)
    .map(([name, field]) => ({ label: field.label, text: fieldText(field, config[name], nameOf) }))
}

type Moved = ReadonlyArray<{ readonly label: string; readonly from: string | null; readonly to: string | null }>

/** One row of the change: its title, each value that moves, and whether it got tighter or looser. */
function ChangeRow({ title, moved, change }: Readonly<{ title: string; moved: Moved; change: ChangeKind }>) {
  return (
    <li className="grid gap-x-3 gap-y-1.5 border-b border-g-100 px-[18px] py-3 text-[13.5px] last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-start">
      <span className="font-semibold">{title}</span>
      <span className="grid min-w-0 gap-1">
        {moved.map((value) => (
          <span key={value.label} className="flex min-w-0 flex-wrap items-center gap-1.5 tabular-nums">
            {/* A label that only repeats the row's title ("Max in one stock") is left out. */}
            {value.label === title ? null : <span className="text-g-500">{value.label}</span>}
            {value.from === null ? null : <s className="text-g-500">{value.from}</s>}
            {value.from === null || value.to === null ?
              null :
              <Icon name="arrow-right" size={14} className="text-g-400" />}
            {value.to === null ? null : <b className="font-semibold">{value.to}</b>}
          </span>
        ))}
      </span>
      <ChangeMark change={change} icon />
    </li>
  )
}

/**
 * A change of policies, policy by policy: each value that moves (struck through, then the new one), and whether the
 * policy got tighter or looser, or was added or removed. The daily budget is a row of its own, apart from the stocks
 * and direction its policy also holds: a bigger budget is looser, a smaller one tighter.
 */
export function SpecChangeRows(
  { before, after, changes, nameOf }: Readonly<{
    before: AgentSpec
    after: AgentSpec
    changes: SpecChanges
    nameOf: (symbol: StockSymbol) => string
  }>
) {
  return (
    <ul className="grid">
      {changes.policies.filter((change) => !policyOf(change.policy).hidden).flatMap(({ policy, change }) => {
        const old = valuesOf(before, policy, nameOf)
        const next = valuesOf(after, policy, nameOf)
        const moved = change === "removed" ?
          old.map((value) => ({ label: value.label, from: value.text, to: null })) :
          next
            .map((value) => ({
              label: value.label,
              from: old.find((was) => was.label === value.label)?.text ?? null,
              to: value.text
            }))
            .filter((value) => value.from !== value.to)

        const title = policyOf(policy).title
        if (policy !== "trade" || change === "added" || change === "removed") {
          return [<ChangeRow key={policy} title={title} moved={moved} change={change} />]
        }

        const budgetLabel = trade.fields.dailyBudget.label
        const budget = moved.filter((value) => value.label === budgetLabel)
        const rest = moved.filter((value) => value.label !== budgetLabel)
        const budgets = [before, after].map((spec) => configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0))
        return [
          ...(rest.length === 0 ? [] : [<ChangeRow key="trade" title={title} moved={rest} change={change} />]),
          ...(budget.length === 0 ? [] : [
            <ChangeRow
              key="dailyBudget"
              title={budgetLabel}
              moved={budget}
              change={budgets[1]! > budgets[0]! ? "looser" : "tighter"}
            />
          ])
        ]
      })}
    </ul>
  )
}
