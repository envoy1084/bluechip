import { SIMPLE_CONDITIONS } from "@bluechip/domain/automations/conditions/Logic"
import type { Field } from "@bluechip/domain/automations/Entry"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import {
  type CatalogEntry,
  catalogEntry,
  changeField,
  type Entry,
  fieldsOf,
  freshEntry,
  type Kind,
  offeredTrades
} from "../../model/drafts.ts"
import { CheckMenu } from "./CheckMenu.tsx"
import { CheckRow } from "./CheckRow.tsx"
import type { EditorContext } from "./editorContext.ts"
import { EntryChoice } from "./EntryChoice.tsx"
import { EntryField } from "./EntryField.tsx"

const SIMPLE = SIMPLE_CONDITIONS as unknown as ReadonlyArray<CatalogEntry>

/**
 * The checks of `all` or `any`: at least one, each removable while others are left, joined by "and" or "or" down a
 * line that shows they belong together.
 */
function NestedConditions(
  { value, joiner, context, problem, onChange }: Readonly<{
    value: ReadonlyArray<Entry>
    /** "and" for `all`, "or" for `any`. */
    joiner: string
    context: EditorContext
    problem: string | undefined
    onChange: (conditions: ReadonlyArray<Entry>) => void
  }>
) {
  // Conditions have no ids of their own; these keep each one's fields in place as others come and go.
  const [keys, setKeys] = useState(() => value.map(() => crypto.randomUUID()))
  const stock = context.stocks[0]!.symbol
  const change = (index: number, next: Entry) => onChange(value.map((each, at) => at === index ? next : each))

  return (
    <div className="grid gap-3 border-l-2 border-blue-100 pl-3.5">
      {value.map((condition, index) => (
        <div key={`${keys[index]}-${condition.type}`} className="grid gap-3">
          {index === 0 ?
            null :
            <span className="text-caption font-semibold tracking-[.06em] text-blue uppercase">{joiner}</span>}
          <CheckRow
            label={`check ${index + 1} of this group`}
            value={condition}
            entries={SIMPLE}
            context={context}
            onChange={(type) => change(index, freshEntry("condition", type, stock))}
            onRemove={value.length > 1 ?
              () => {
                setKeys(keys.filter((_, at) => at !== index))
                onChange(value.filter((_, at) => at !== index))
              } :
              undefined}
          >
            <EntryEditor
              kind="condition"
              value={condition}
              context={context}
              problemOf={() => undefined}
              onChange={(next) => change(index, next)}
            />
          </CheckRow>
        </div>
      ))}
      <CheckMenu
        entries={SIMPLE}
        trigger={<Button variant="ghost" size="sm" className="justify-self-start text-blue" />}
        onPick={(type) => {
          setKeys([...keys, crypto.randomUUID()])
          onChange([...value, freshEntry("condition", type, stock)])
        }}
      >
        <Icon name="plus" size={14} />Add another check
      </CheckMenu>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}

// Fields small enough to sit two to a row, when the editor is wide enough: a time beside its zone, From beside To.
const HALF = new Set(["time", "timeZone", "stock"])

/**
 * The fields of a trigger, condition or action, one after another from the catalog's hints, short ones side by side
 * where there is room; the checks of `all`, `any` and `not`, and the trade `ask` proposes, are edited in place.
 */
export function EntryEditor(
  { kind, value, context, problemOf, onChange }: Readonly<{
    kind: Kind
    value: Entry
    context: EditorContext
    problemOf: (field: string) => string | undefined
    onChange: (entry: Entry) => void
  }>
) {
  const entry = catalogEntry(kind, value.type)
  const config = value.config as Record<string, unknown>
  const stock = context.stocks[0]!.symbol
  const set = (name: string, next: unknown) => onChange(changeField(value, name, next, stock))
  const fields = fieldsOf(entry)
  if (fields.length === 0) return null

  const fieldOf = (name: string, field: Field) => {
    if (field.unit === "action") {
      const trade = config[name] as Entry
      return (
        <div className="grid gap-3">
          <span className="text-[13.5px] font-medium text-g-700">{field.label}</span>
          <EntryChoice
            label={field.label}
            value={trade.type}
            entries={offeredTrades(context.check)}
            context={{ ...context.check, asking: true }}
            size="sm"
            onChange={(type) => set(name, freshEntry("action", type, stock))}
          />
          <EntryEditor
            kind="action"
            value={trade}
            context={context}
            problemOf={() => undefined}
            onChange={(next) => set(name, next)}
          />
        </div>
      )
    }

    if (field.unit === "conditions") {
      // `not` holds one check; `all` and `any` a list of at least one.
      if (!Array.isArray(config[name])) {
        return (
          <div className="border-l-2 border-blue-100 pl-3.5">
            <CheckRow
              label="the check it turns around"
              value={config[name] as Entry}
              entries={SIMPLE}
              context={context}
              onChange={(type) => set(name, freshEntry("condition", type, stock))}
            >
              <EntryEditor
                kind="condition"
                value={config[name] as Entry}
                context={context}
                problemOf={() => undefined}
                onChange={(next) => set(name, next)}
              />
            </CheckRow>
          </div>
        )
      }
      return (
        <NestedConditions
          value={config[name] as ReadonlyArray<Entry>}
          joiner={value.type === "any" ? "or" : "and"}
          context={context}
          problem={problemOf(name)}
          onChange={(next) => set(name, next)}
        />
      )
    }

    return (
      <EntryField
        entry={entry}
        name={name}
        field={field}
        value={config[name]}
        config={config}
        context={context}
        problem={problemOf(name)}
        onChange={(next) => set(name, next)}
      />
    )
  }

  return (
    <div className="@container">
      <div className="grid gap-4 @xl:grid-cols-2 *:empty:hidden">
        {fields.map(([name, field]) => (
          <div key={name} className={HALF.has(field.unit) ? "min-w-0" : "min-w-0 @xl:col-span-2"}>
            {fieldOf(name, field)}
          </div>
        ))}
      </div>
    </div>
  )
}
