import type { Allocation } from "@bluechip/domain/automations/actions/Buy"
import type { Field } from "@bluechip/domain/automations/Entry"
import type { Weekday } from "@bluechip/domain/automations/Time"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { formatDollars, formatPercent } from "@bluechip/domain/policies/Format"
import { ChoiceField } from "../../../../components/fields/ChoiceField.tsx"
import { NumberField } from "../../../../components/fields/NumberField.tsx"
import { StockField } from "../../../../components/fields/StockField.tsx"
import { TimeField } from "../../../../components/fields/TimeField.tsx"
import { ToggleField } from "../../../../components/fields/ToggleField.tsx"
import { ZoneField } from "../../../../components/fields/ZoneField.tsx"
import { choiceLabel } from "../../model/automationText.ts"
import { type CatalogEntry, choicesOf, evenSplit, fieldsOf } from "../../model/drafts.ts"
import type { EditorContext } from "./editorContext.ts"
import { PriceLevelField } from "./fields/PriceLevelField.tsx"
import { StockPicker } from "./fields/StockPicker.tsx"
import { TextField } from "./fields/TextField.tsx"
import { WeekdaysField } from "./fields/WeekdaysField.tsx"

const USDC = 1_000_000
const SHARE = 100_000_000

// A field offered as a few choices (and no step) is picked from them; the value in force stays offered too.
const choicesFor = (field: Field, value: number): ReadonlyArray<number> | undefined => {
  if (field.choices === undefined || field.step !== undefined) return undefined
  return field.choices.includes(value) ? field.choices : [...field.choices, value].toSorted((a, b) => a - b)
}

/**
 * One field of a trigger, condition or action, edited from its catalog hint: its label, unit, range, step and choices.
 * The nested units (`conditions`, `action`) are edited by the entry that holds them.
 */
export function EntryField(
  { entry, name, field, value, config, context, problem, onChange }: Readonly<{
    entry: CatalogEntry
    name: string
    field: Field
    value: unknown
    /** The entry's whole configuration, for choices that read differently with the rest ("Its high" on a fall). */
    config: unknown
    context: EditorContext
    problem?: string | undefined
    onChange: (value: unknown) => void
  }>
) {
  const common = { label: field.label, problem }

  switch (field.unit) {
    case "usd": {
      const dollars = Number(value as bigint) / USDC
      const min = (field.min ?? USDC) / USDC
      return (
        <NumberField
          {...common}
          unit="dollars"
          value={dollars}
          min={min}
          max={field.max === undefined ? Math.max(min * 10, dollars * 2, 1000) : field.max / USDC}
          step={(field.step ?? USDC) / USDC}
          onChange={(next) => onChange(Usdc.make(BigInt(Math.round(next * USDC))))}
        />
      )
    }
    case "bps": {
      const choices = choicesFor(field, value as number)
      if (choices !== undefined) {
        return (
          <ChoiceField
            {...common}
            value={value as number}
            options={choices.map((choice) => ({ value: choice, label: formatPercent(choice) }))}
            onChange={onChange}
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
          step={(field.step ?? 100) / 100}
          onChange={(percent) => onChange(Math.round(percent * 100))}
        />
      )
    }
    case "count":
    case "minutes": {
      // Shares are counted in whole shares here; 0 means any at all.
      const shares = typeof value === "bigint"
      return (
        <NumberField
          {...common}
          unit="count"
          help={shares && value === BigInt(0) ? "0 means while you hold any." : undefined}
          value={shares ? Number(value) / SHARE : value as number}
          min={field.min ?? 0}
          max={field.max ?? (shares ? 100 : 1440)}
          step={field.step ?? 1}
          onChange={(count) =>
            onChange(shares ? Shares.make(BigInt(Math.round(count)) * BigInt(SHARE)) : Math.round(count))}
        />
      )
    }
    case "stock":
      // A portfolio trigger on cash has no stock.
      return value === null ? null : (
        <StockPicker
          {...common}
          value={value as StockSymbol}
          stocks={context.stocks}
          onChange={onChange}
        />
      )
    case "stocks":
      return (
        <StockField
          {...common}
          value={value as ReadonlyArray<StockSymbol>}
          stocks={context.stocks}
          onChange={onChange}
        />
      )
    case "split": {
      const parts = (value as ReadonlyArray<Allocation>).length
      const amount = (config as { readonly amount?: unknown }).amount
      return (
        <div className="grid gap-1">
          <StockField
            {...common}
            value={(value as ReadonlyArray<Allocation>).map((part) => part.symbol)}
            stocks={context.stocks}
            onChange={(symbols) => onChange(evenSplit(symbols))}
          />
          {parts > 1 ?
            (
              <p className="text-label-sm text-g-500">
                {typeof amount === "bigint" ?
                  `Split evenly, about ${formatDollars(amount / BigInt(parts))} each.` :
                  "Split evenly across them."}
              </p>
            ) :
            null}
        </div>
      )
    }
    case "price": {
      // The price is about the entry's own stock, when it has one.
      const stockField = fieldsOf(entry).find(([, hint]) => hint.unit === "stock")
      const symbol = stockField === undefined ? undefined : (config as Record<string, unknown>)[stockField[0]]
      return (
        <PriceLevelField
          {...common}
          value={value as bigint}
          stock={context.stocks.find((stock) => stock.symbol === symbol)}
          onChange={onChange}
        />
      )
    }
    case "time":
      return <TimeField {...common} value={value as string} onChange={onChange} />
    case "weekdays":
      return <WeekdaysField {...common} value={value as ReadonlyArray<Weekday>} onChange={onChange} />
    case "timeZone":
      return <ZoneField label={field.label} value={value as string} zone={context.zone} onChange={onChange} />
    case "choice":
      return (
        <ChoiceField
          {...common}
          value={value as string}
          options={choicesOf(entry, name).map((choice) => ({
            value: choice,
            label: choiceLabel(entry.type, name, choice, config)
          }))}
          onChange={onChange}
        />
      )
    case "toggle":
      return <ToggleField {...common} checked={value === true} onChange={onChange} />
    case "text":
      return (
        <TextField
          {...common}
          placeholder={typeof value === "string" ? "Time to look at your chip stocks" : "chips, AI"}
          help={typeof value === "string" ? undefined : "Words the story has to mention, with commas between them."}
          value={value as string | ReadonlyArray<string>}
          onChange={onChange}
        />
      )
    case "conditions":
    case "action":
      return null
  }
}
