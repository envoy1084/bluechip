import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { cashReserve } from "@bluechip/domain/policies/CashReserve"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf, type Field } from "@bluechip/domain/policies/Policy"
import type { Target } from "@bluechip/domain/policies/Rebalance"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import type { Floor } from "@bluechip/domain/policies/StopLossFloor"
import { type Direction, trade } from "@bluechip/domain/policies/Trade"
import { ChoiceField } from "../../../../../components/fields/ChoiceField.tsx"
import { NumberField } from "../../../../../components/fields/NumberField.tsx"
import { StockField } from "../../../../../components/fields/StockField.tsx"
import { ToggleField } from "../../../../../components/fields/ToggleField.tsx"
import { toDollars, toEther } from "../../../model/fieldText.ts"
import { DirectionField } from "./DirectionField.tsx"
import { FloorsField } from "./FloorsField.tsx"
import { MixField } from "./MixField.tsx"

/** What a field's editor may read besides its own value: the whole draft, the stocks bluechip lists. */
export interface FieldContext {
  readonly spec: AgentSpec
  readonly stocks: ReadonlyArray<Stock>
  /** Changes when what the target mix depends on changes, so the mix editor starts again. */
  readonly mixKey: string
  readonly nameOf: (symbol: StockSymbol) => string
}

const DEFAULT_DOLLAR_STEP = 1_000_000

// A field offered as a few choices (and no step) is picked from them; the value in force stays offered too.
const choicesOf = (field: Field, value: number): ReadonlyArray<number> | undefined => {
  if (field.choices === undefined || field.step !== undefined) return undefined
  return field.choices.includes(value) ? field.choices : [...field.choices, value].toSorted((a, b) => a - b)
}

export function FieldEditor(
  { field, title, value, context, help, choiceLabel, disabled, problem, onChange }: Readonly<{
    field: Field
    /** The title of the rule it edits: a label that only repeats it is left to screen readers. */
    title?: string

    value: unknown
    context: FieldContext
    help?: string | undefined
    /** How a choice reads, when the unit alone doesn't say enough ("Strict, 0.5%"). */
    choiceLabel?: (choice: number) => string
    disabled?: boolean
    problem?: string | undefined
    onChange: (value: unknown) => void
  }>
) {
  const common = { label: field.label, labelHidden: field.label === title, help, problem }

  switch (field.unit) {
    case "usd": {
      const min = toDollars(field.min ?? 0)
      return (
        <NumberField
          {...common}
          unit="dollars"
          value={toDollars(value as bigint)}
          min={min}
          max={toDollars(field.sliderMax ?? field.max ?? Math.max(min * 10, 1000))}
          // A field with a slider end but no ceiling takes any custom amount.
          ceiling={field.max !== undefined
            ? toDollars(field.max)
            : field.sliderMax !== undefined
            ? Infinity
            : undefined}
          step={toDollars(field.step ?? DEFAULT_DOLLAR_STEP)}
          onChange={(dollars) => onChange(Usdc.make(BigInt(Math.round(dollars * 1_000_000))))}
        />
      )
    }
    case "bps":
    case "count": {
      const choices = choicesOf(field, value as number)
      if (choices !== undefined) {
        return (
          <ChoiceField
            {...common}
            value={value as number}
            options={choices.map((choice) => ({
              value: choice,
              label: choiceLabel?.(choice) ?? (field.unit === "bps" ? formatPercent(choice) : String(choice))
            }))}
            onChange={onChange}
          />
        )
      }
      if (field.unit === "count") {
        return (
          <NumberField
            {...common}
            unit="count"
            value={value as number}
            min={field.min ?? 0}
            max={field.sliderMax ?? field.max ?? 100}
            ceiling={field.max}
            step={field.step ?? 1}
            onChange={(count) => onChange(Math.round(count))}
          />
        )
      }
      return (
        <NumberField
          {...common}
          unit="percent"
          value={(value as number) / 100}
          min={(field.min ?? 0) / 100}
          max={(field.max ?? 10_000) / 100}
          step={(field.step ?? 1) / 100}
          onChange={(percent) => onChange(Math.round(percent * 100))}
        />
      )
    }
    case "toggle":
      return (
        <ToggleField
          label={field.label}
          help={help}
          problem={problem}
          checked={value === true}
          disabled={disabled ?? false}
          onChange={onChange}
        />
      )
    case "stocks":
      return (
        <StockField
          label={field.label}
          problem={problem}
          value={value as ReadonlyArray<StockSymbol>}
          stocks={context.stocks}
          onChange={onChange}
        />
      )
    case "direction":
      return <DirectionField label={field.label} problem={problem} value={value as Direction} onChange={onChange} />
    case "mix":
      return (
        <MixField
          label={field.label}
          problem={problem}
          stocks={configOf(context.spec.policies, trade)?.stocks ?? []}
          targets={value as ReadonlyArray<Target>}
          capBps={configOf(context.spec.policies, stockCap)?.maxBps ?? 10_000}
          reserveBps={configOf(context.spec.policies, cashReserve)?.minBps ?? 0}
          mixKey={context.mixKey}
          onChange={onChange}
        />
      )
    case "floors":
      return (
        <FloorsField
          label={field.label}
          problem={problem}
          value={value as ReadonlyArray<Floor>}
          symbols={configOf(context.spec.policies, trade)?.stocks ?? []}
          stocks={context.stocks}
          nameOf={context.nameOf}
          onChange={onChange}
        />
      )
    // Edited in ether; the policy keeps wei. A thousandth of an ether is the finest step it offers.
    case "wei":
      return (
        <NumberField
          {...common}
          unit="ether"
          value={toEther(value as bigint)}
          min={toEther(field.min ?? 0)}
          max={toEther(field.sliderMax ?? field.max ?? 1e17)}
          ceiling={field.max === undefined ? undefined : toEther(field.max)}
          step={toEther(field.step ?? 1e15)}
          onChange={(ether) => onChange(BigInt(Math.round(ether * 1000)) * BigInt(1e15))}
        />
      )
  }
}
