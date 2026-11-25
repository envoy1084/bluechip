import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf, type SpecChanges } from "@bluechip/domain/policies/Catalog"
import type { Field } from "@bluechip/domain/policies/Policy"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { fieldText } from "./fieldText.ts"

type Values = ReadonlyArray<{ readonly label: string; readonly text: string }>

const valuesOf = (spec: AgentSpec, id: PolicyId, nameOf: (symbol: StockSymbol) => string): Values => {
  const config = spec.policies.find((entry) => entry.id === id)?.config as Record<string, unknown> | undefined
  if (config === undefined) return []
  return Object.entries(policyOf(id).fields as Record<string, Field>)
    .map(([name, field]) => ({ label: field.label, text: fieldText(field, config[name], nameOf) }))
}

const MARK = {
  tighter: {
    label: "Tighter",
    icon: "shield",
    tone: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]"
  },
  added: {
    label: "New",
    icon: "shield",
    tone: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]"
  },
  looser: {
    label: "Looser",
    icon: "unlock",
    tone: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
  },
  removed: {
    label: "Removed",
    icon: "unlock",
    tone: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
  }
} as const

/**
 * A change of policies, policy by policy: each value that moves (struck through, then the new one), and whether the
 * policy got tighter or looser, or was added or removed.
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
      {changes.policies.filter((change) => !policyOf(change.policy).hidden).map(({ policy, change }) => {
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
        const mark = MARK[change as keyof typeof MARK]

        return (
          <li
            key={policy}
            className="grid gap-x-3 gap-y-1.5 border-b border-g-100 px-[18px] py-3 text-[13.5px] last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-start"
          >
            <span className="font-semibold">{policyOf(policy).title}</span>
            <span className="grid min-w-0 gap-1">
              {moved.map((value) => (
                <span key={value.label} className="flex min-w-0 flex-wrap items-center gap-1.5 tabular-nums">
                  <span className="text-g-500">{value.label}</span>
                  {value.from === null ? null : <s className="text-g-500">{value.from}</s>}
                  {value.from === null || value.to === null ?
                    null :
                    <Icon name="arrow-right" size={14} className="text-g-400" />}
                  {value.to === null ? null : <b className="font-semibold">{value.to}</b>}
                </span>
              ))}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 justify-self-start rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap",
                mark.tone
              )}
            >
              <Icon name={mark.icon} size={12} />
              {mark.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
