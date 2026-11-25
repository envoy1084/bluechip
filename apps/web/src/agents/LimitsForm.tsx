import { Limits } from "@bluechip/domain/agents/Limits"
import { compare, type LimitField, validate } from "@bluechip/domain/agents/Rules"
import { BOUNDS, draftLimits, Preset, type Template, TEMPLATES } from "@bluechip/domain/agents/Templates"
import type { Stock } from "@bluechip/domain/market/Market"
import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import { TickerToggle } from "@bluechip/ui/bluechip/ticker-chip"
import { LIMIT_FIELDS, type LimitField as UiLimitField } from "@bluechip/ui/lib/agent-limits"
import { type ReactNode, useId, useState } from "react"
import { LIMIT_LABELS } from "./limitFields.ts"
import { uiLimits, withUiLimits } from "./limits.ts"
import { AdvancedLimits } from "./LimitsFormAdvanced.tsx"
import { LimitSection, NumberLimit } from "./LimitsFormFields.tsx"
import { evenTargets, TargetMixSection } from "./LimitsFormMix.tsx"

type NumberField = "dailyBudget" | "maxPerTrade" | "maxInOneStock" | "cashReserve" | "askAbove"

// The five number limits in the editor's order, each with its name in `@bluechip/ui`'s view of limits.
const NUMBER_FIELDS: ReadonlyArray<{ readonly field: NumberField; readonly ui: UiLimitField }> = [
  { field: "dailyBudget", ui: "dailySpend" },
  { field: "maxPerTrade", ui: "maxPerTrade" },
  { field: "maxInOneStock", ui: "maxInOneStock" },
  { field: "cashReserve", ui: "cashReserve" },
  { field: "askAbove", ui: "approveAbove" }
]

const PRESET_FIELDS = ["dailyBudget", "maxPerTrade", "askAbove", "maxInOneStock", "cashReserve"] as const

const dollars = (amount: bigint) => Number(amount) / 1_000_000

/** The range each number limit takes, in the editor's units; a template's daily ceiling caps the daily spend. */
const rangeOf = (field: NumberField, template: Template): { readonly min: number; readonly max: number } => {
  if (field === "dailyBudget") {
    const ceiling = TEMPLATES[template].maxDailyBudget
    return { min: 0, max: dollars(ceiling < BOUNDS.dailyBudget.max ? ceiling : BOUNDS.dailyBudget.max) }
  }
  if (field === "maxPerTrade" || field === "askAbove") {
    return { min: dollars(BOUNDS[field].min), max: dollars(BOUNDS[field].max) }
  }
  return { min: BOUNDS[field].min / 100, max: BOUNDS[field].max / 100 }
}

const HELP: Partial<Record<NumberField, string>> = {
  dailyBudget: "The most it can spend on buys in a day. Resets at midnight UTC."
}

/**
 * An agent's limits, set from a preset and fine-tuned: the stocks it trades, the five number limits, a Rebalancer's
 * target mix, and the advanced settings. Each problem that blocks locking shows where it is. With `before` (the
 * limits locked now), each change is marked tighter or looser.
 */
export function LimitsForm(
  { template, limits, onChange, stocks, before, header }: Readonly<{
    template: Template
    limits: Limits
    onChange: (limits: Limits) => void
    /** Every stock bluechip lists; the ones without a pool can't be picked unless the agent already trades them. */
    stocks: ReadonlyArray<Stock>
    before?: Limits
    /** The first block of the card, like the agent's name. */
    header?: ReactNode
  }>
) {
  const id = useId()
  const [mixKey, setMixKey] = useState(0)
  const problems = validate(limits, template)
  const changes = before === undefined ? undefined : compare(before, limits).fields
  const problemOf = (field: LimitField) => problems.find((problem) => problem.field === field)?.message
  const rebalancer = TEMPLATES[template].mode === "rebalance"

  const pickable = stocks.filter((stock) => stock.tradable || limits.stocks.includes(stock.symbol))
  const toggleStock = (symbol: Stock["symbol"], pressed: boolean) => {
    const picked = pickable
      .map((stock) => stock.symbol)
      .filter((candidate) => candidate === symbol ? pressed : limits.stocks.includes(candidate))
    const next = new Limits({ ...limits, stocks: picked })

    onChange(rebalancer ? new Limits({ ...next, targets: evenTargets(picked, next) }) : next)
    setMixKey((key) => key + 1)
  }

  const presetLimits = (preset: Preset) =>
    draftLimits({ template, preset, stocks: limits.stocks, targets: limits.targets })
  const preset = Preset.literals.find((candidate) => {
    const drafted = presetLimits(candidate)
    return PRESET_FIELDS.every((field) => drafted[field] === limits[field])
  })
  const applyPreset = (picked: Preset) => {
    const drafted = presetLimits(picked)
    onChange(
      new Limits({
        ...limits,
        dailyBudget: drafted.dailyBudget,
        maxPerTrade: drafted.maxPerTrade,
        askAbove: drafted.askAbove,
        maxInOneStock: drafted.maxInOneStock,
        cashReserve: drafted.cashReserve
      })
    )
  }

  const shown = NUMBER_FIELDS.filter(({ field }) => field !== "dailyBudget" || rangeOf(field, template).max > 0)

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-e2">
      {header}

      <LimitSection
        title={LIMIT_LABELS.stocks}
        titleId={`${id}-stocks`}
        change={changes?.stocks}
        problem={problemOf("stocks")}
      >
        <fieldset aria-labelledby={`${id}-stocks`} className="flex flex-wrap gap-1.5">
          {pickable.map((stock) => (
            <TickerToggle
              key={stock.symbol}
              symbol={stock.symbol}
              name={stock.name}
              pressed={limits.stocks.includes(stock.symbol)}
              onPressedChange={(pressed) => toggleStock(stock.symbol, pressed)}
            />
          ))}
        </fieldset>
      </LimitSection>

      <LimitSection title="Start from a preset">
        <PresetPicker value={preset ?? null} onValueChange={(picked) => applyPreset(picked.name)} />
        {preset === undefined && <p className="text-label-sm text-g-500">Custom limits.</p>}
      </LimitSection>

      {shown.map(({ field, ui }) => {
        const spec = LIMIT_FIELDS.find((candidate) => candidate.field === ui)!
        const range = rangeOf(field, template)
        return (
          <NumberLimit
            key={field}
            label={spec.label}
            help={HELP[field] ?? spec.help}
            value={uiLimits(limits)[ui]}
            min={range.min}
            max={range.max}
            step={spec.step}
            unit={spec.unit}
            change={changes?.[field]}
            problem={problemOf(field)}
            onChange={(value) => onChange(withUiLimits(limits, { ...uiLimits(limits), [ui]: value }))}
          />
        )
      })}

      {rebalancer && (
        <TargetMixSection
          limits={limits}
          mixKey={mixKey}
          change={changes?.targets}
          triggerChange={changes?.rebalanceTrigger}
          problem={problemOf("targets")}
          onChange={onChange}
        />
      )}

      <AdvancedLimits template={template} limits={limits} changes={changes} problems={problems} onChange={onChange} />
    </div>
  )
}
