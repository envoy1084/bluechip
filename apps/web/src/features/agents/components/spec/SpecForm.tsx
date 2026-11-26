import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { cashReserve } from "@bluechip/domain/policies/CashReserve"
import { checkSpec, compareSpecs } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { applyPreset, presetOf } from "@bluechip/domain/policies/SpecEdits"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { Preset, type TemplateId } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { PolicyGroup } from "@bluechip/ui/bluechip/policy-row"
import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { policySections } from "../../model/policySections.ts"
import { presetAmounts } from "../../model/presetAmounts.ts"
import { ChangeMark } from "./ChangeMark.tsx"
import { TradeEditor } from "./editors/TradeEditor.tsx"
import type { FieldContext } from "./fields/FieldEditor.tsx"
import { RuleRow } from "./RuleRow.tsx"

/**
 * An agent's policies, one decision at a time: what it trades, then its limits (a preset sets them; each rule folds to
 * a line you can open and edit, and optional rules switch on and off), then the fine-tuning most people leave alone,
 * folded away unless it blocks locking. With `before` (the policies in force), each rule is marked tighter, looser,
 * new or removed.
 */
export function SpecForm(
  { spec, onChange, stocks, nameOf, template, before }: Readonly<{
    spec: AgentSpec
    onChange: (spec: AgentSpec) => void
    /** Every stock bluechip lists; the ones without a pool can't be picked unless the agent already trades them. */
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    /** The built-in template it started from, for its presets. */
    template: TemplateId | null
    before?: AgentSpec | undefined
  }>
) {
  const [opened, setOpened] = useState<ReadonlySet<PolicyId>>(() => new Set())
  const [carried, setCarried] = useState(() => spec.policies.map((entry) => entry.id).join())

  // A rule that just came on (its switch, or Rebalance only turning on the target mix) opens to be set.
  const carriedNow = spec.policies.map((entry) => entry.id).join()
  if (carriedNow !== carried) {
    const before = carried.split(",")
    setCarried(carriedNow)
    setOpened((ids) =>
      new Set([...ids, ...spec.policies.map((entry) => entry.id).filter((id) => !before.includes(id))])
    )
  }
  const [fineTuningOpen, setFineTuningOpen] = useState(false)
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

  const sections = policySections(spec)
  const limits = [...sections.limits, ...sections.more]
  const fineTuning = [...sections.fineTuning, ...sections.fineTuningToAdd]
  const fineTuningProblem = problems.some((problem) => sections.fineTuning.includes(problem.policy))
  const preset = template === null ? undefined : presetOf(spec, template, Preset.literals)

  const row = (id: PolicyId) => (
    <RuleRow
      key={id}
      id={id}
      context={context}
      nameOf={nameOf}
      change={changeOf(id)}
      open={opened.has(id)}
      onOpenChange={(open) =>
        setOpened((ids) => {
          const next = new Set(ids)
          if (open) next.add(id)
          else next.delete(id)
          return next
        })}
      problem={problems.find((problem) => problem.policy === id)?.message}
      problemOf={(field) => problemOf(id, field)}
      onSpecChange={onChange}
    />
  )

  return (
    <div className="grid min-w-0 gap-3.5">
      <PolicyGroup
        title="What it trades"
        description="The stocks it may trade, which way, and what it may spend."
        aside={<ChangeMark change={changeOf("trade")} />}
      >
        <div className="grid gap-4 px-[18px] py-4">
          <TradeEditor
            id="trade"
            context={context}
            problemOf={(field) => problemOf("trade", field)}
            onSpecChange={onChange}
          />
          {problemOf("trade", null) === undefined ?
            null :
            <p className="text-label-sm font-medium text-loss">{problemOf("trade", null)}</p>}
        </div>
      </PolicyGroup>

      <PolicyGroup title="Its limits" description="Checked onchain on every trade it makes.">
        {template === null ? null : (
          <div className="grid gap-2 border-b border-g-100 px-[18px] py-4">
            <span className="text-label font-semibold text-g-800">Start from a preset</span>
            <PresetPicker
              value={preset ?? null}
              amounts={presetAmounts(template)}
              onValueChange={(picked) => onChange(applyPreset(spec, template, picked.name))}
            />
            {preset === undefined && <p className="text-label-sm text-g-500">Custom amounts.</p>}
          </div>
        )}
        {limits.map(row)}
      </PolicyGroup>

      <Collapsible
        open={fineTuningOpen || fineTuningProblem}
        onOpenChange={setFineTuningOpen}
        className="overflow-hidden rounded-lg bg-white shadow-e1"
      >
        <CollapsibleTrigger className="group/adv flex w-full cursor-pointer items-center justify-between gap-2 px-[18px] py-3.5 text-left hover:bg-g-50">
          <span className="grid gap-0.5">
            <span className="text-[14px] font-semibold">Fine-tuning</span>
            <span className="text-label text-g-500">
              Price checks, slippage and trades a day. Most people leave these.
            </span>
          </span>
          <Icon
            name="chevron-down"
            size={16}
            className="text-g-500 transition-transform duration-base ease-brand group-data-panel-open/adv:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-g-100">{fineTuning.map(row)}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
