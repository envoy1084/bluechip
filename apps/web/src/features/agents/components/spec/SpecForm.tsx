import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { cashReserve } from "@bluechip/domain/policies/CashReserve"
import { checkSpec, compareSpecs, policyOf } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { applyPreset, presetOf } from "@bluechip/domain/policies/SpecEdits"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { Preset, type TemplateId } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { Icon } from "@bluechip/ui/icons/icon"
import { type ReactNode, useState } from "react"
import { presetAmounts } from "../../model/presetAmounts.ts"
import { PolicyEditor } from "./editors/PolicyEditor.tsx"
import type { FieldContext } from "./fields/FieldEditor.tsx"
import { PolicySection } from "./fields/PolicySection.tsx"
import { PolicyPicker } from "./PolicyPicker.tsx"

// Settings most people leave as they are, folded away unless one of them blocks locking.
const ADVANCED: ReadonlyArray<PolicyId> = ["fairPrice", "slippageBudget", "tradesPerDay"]

/**
 * An agent's policies, set from a template's preset and fine-tuned: which rules it carries, then one editor per rule.
 * Each problem that blocks locking shows where it is. With `before` (the policies in force), each rule is marked
 * tighter, looser, new or removed.
 */
export function SpecForm(
  { spec, onChange, stocks, nameOf, template, before, header }: Readonly<{
    spec: AgentSpec
    onChange: (spec: AgentSpec) => void
    /** Every stock bluechip lists; the ones without a pool can't be picked unless the agent already trades them. */
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    /** The built-in template it started from, for its presets. */
    template: TemplateId | null
    before?: AgentSpec | undefined
    header?: ReactNode
  }>
) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const problems = checkSpec(spec)
  const changes = before === undefined ? [] : compareSpecs(before, spec).policies
  const changeOf = (id: PolicyId) => changes.find((change) => change.policy === id)?.change
  const problemOf = (id: PolicyId, field: string | null) =>
    problems.find((problem) => problem.policy === id && problem.field === field)?.message

  const context: FieldContext = {
    spec,
    stocks,
    nameOf,
    mixKey: [
      ...(configOf(spec.policies, trade)?.stocks ?? []),
      configOf(spec.policies, stockCap)?.maxBps,
      configOf(spec.policies, cashReserve)?.minBps
    ].join()
  }

  const shown = spec.policies.filter((entry) => !policyOf(entry.id).hidden).map((entry) => entry.id)
  const advanced = shown.filter((id) => ADVANCED.includes(id))
  const advancedProblem = problems.some((problem) => advanced.includes(problem.policy))
  const preset = template === null ? undefined : presetOf(spec, template, Preset.literals)

  const section = (id: PolicyId) => (
    <PolicySection key={id} title={policyOf(id).title} change={changeOf(id)} problem={problemOf(id, null)}>
      <PolicyEditor
        id={id}
        context={context}
        problemOf={(field) =>
          problemOf(id, field)}
        onSpecChange={onChange}
      />
    </PolicySection>
  )

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-e2">
      {header}

      {template === null ? null : (
        <PolicySection title="Start from a preset">
          <PresetPicker
            value={preset ?? null}
            amounts={presetAmounts(template)}
            onValueChange={(picked) => onChange(applyPreset(spec, template, picked.name))}
          />
          {preset === undefined && <p className="text-label-sm text-g-500">Custom amounts.</p>}
        </PolicySection>
      )}

      <PolicyPicker spec={spec} changeOf={changeOf} onChange={onChange} />

      {shown.filter((id) => !ADVANCED.includes(id)).map(section)}

      {advanced.length === 0 ?
        null :
        (
          <Collapsible
            open={advancedOpen || advancedProblem}
            onOpenChange={setAdvancedOpen}
            className="border-t border-g-100"
          >
            <CollapsibleTrigger className="group/adv flex w-full cursor-pointer items-center justify-between gap-2 px-[18px] py-3.5 text-left text-[13.5px] font-semibold hover:bg-g-50">
              Advanced
              <Icon
                name="chevron-down"
                size={16}
                className="text-g-500 transition-transform group-data-panel-open/adv:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-g-100">{advanced.map(section)}</div>
            </CollapsibleContent>
          </Collapsible>
        )}
    </div>
  )
}
