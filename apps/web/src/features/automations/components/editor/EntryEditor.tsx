import { SIMPLE_CONDITIONS } from "@bluechip/domain/automations/conditions/Logic"
import { Button } from "@bluechip/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { Icon } from "@bluechip/ui/icons/icon"
import { useId, useState } from "react"
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
import type { EditorContext } from "./editorContext.ts"
import { EntryField } from "./EntryField.tsx"

/** Picks which trigger, condition or action an entry is, with what the picked one does under it. */
export function EntryTypeSelect(
  { label, value, entries, onChange }: Readonly<{
    label: string
    value: string
    entries: ReadonlyArray<CatalogEntry>
    onChange: (type: string) => void
  }>
) {
  const id = useId()
  const items = entries.map((entry) => ({ value: entry.type, label: entry.title }))
  const picked = entries.find((entry) => entry.type === value)

  return (
    <div className="grid gap-1.5">
      <span id={id} className="sr-only">{label}</span>
      <Select items={items} value={value} onValueChange={(type) => type !== null && onChange(type)}>
        <SelectTrigger aria-labelledby={id} className="w-full sm:w-[280px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entries.map((entry) => <SelectItem key={entry.type} value={entry.type}>{entry.title}</SelectItem>)}
        </SelectContent>
      </Select>
      {picked === undefined ? null : <p className="text-label text-g-500">{picked.summary}</p>}
    </div>
  )
}

const SIMPLE = SIMPLE_CONDITIONS as unknown as ReadonlyArray<CatalogEntry>

/** One condition inside `all`, `any` or `not`: which one, its fields, and Remove when there may be fewer. */
function NestedCondition(
  { value, context, onChange, onRemove }: Readonly<{
    value: Entry
    context: EditorContext
    onChange: (entry: Entry) => void
    onRemove?: (() => void) | undefined
  }>
) {
  const stock = context.stocks[0]!.symbol

  return (
    <div className="grid gap-3 rounded-[12px] p-3 surface-well">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <EntryTypeSelect
            label="Condition"
            value={value.type}
            entries={SIMPLE}
            onChange={(type) => onChange(freshEntry("condition", type, stock))}
          />
        </div>
        {onRemove === undefined ?
          null :
          (
            <Button variant="ghost" size="icon-sm" aria-label="Remove this condition" onClick={onRemove}>
              <Icon name="close" size={14} />
            </Button>
          )}
      </div>
      <EntryEditor kind="condition" value={value} context={context} problemOf={() => undefined} onChange={onChange} />
    </div>
  )
}

/** The conditions of `all` or `any`: at least one, each removable while others are left. */
function NestedConditions(
  { value, context, problem, onChange }: Readonly<{
    value: ReadonlyArray<Entry>
    context: EditorContext
    problem: string | undefined
    onChange: (conditions: ReadonlyArray<Entry>) => void
  }>
) {
  // Conditions have no ids of their own; these keep each one's fields in place as others come and go.
  const [keys, setKeys] = useState(() => value.map(() => crypto.randomUUID()))
  const stock = context.stocks[0]!.symbol

  return (
    <div className="grid gap-2">
      {value.map((condition, index) => (
        <NestedCondition
          key={`${keys[index]}-${condition.type}`}
          value={condition}
          context={context}
          onChange={(next) => onChange(value.map((each, at) => at === index ? next : each))}
          onRemove={value.length > 1 ?
            () => {
              setKeys(keys.filter((_, at) => at !== index))
              onChange(value.filter((_, at) => at !== index))
            } :
            undefined}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          setKeys([...keys, crypto.randomUUID()])
          onChange([...value, freshEntry("condition", "marketOpen", stock)])
        }}
      >
        <Icon name="plus" size={14} />Add another
      </Button>
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}

/**
 * The fields of a trigger, condition or action, one after another from the catalog's hints; the conditions of
 * `all`, `any` and `not`, and the trade `ask` proposes, are edited in place.
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

  return (
    <div className="grid gap-4 empty:hidden">
      {fieldsOf(entry).map(([name, field]) => {
        if (field.unit === "action") {
          const trade = config[name] as Entry
          return (
            <div key={name} className="grid gap-3 rounded-[12px] p-3 surface-well">
              <span className="text-[13.5px] font-medium text-g-700">{field.label}</span>
              <EntryTypeSelect
                label={field.label}
                value={trade.type}
                entries={offeredTrades(context.check)}
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
          // `not` holds one condition; `all` and `any` a list of at least one.
          if (!Array.isArray(config[name])) {
            return (
              <NestedCondition
                key={name}
                value={config[name] as Entry}
                context={context}
                onChange={(next) => set(name, next)}
              />
            )
          }
          return (
            <NestedConditions
              key={name}
              value={config[name] as ReadonlyArray<Entry>}
              context={context}
              problem={problemOf(name)}
              onChange={(next) => set(name, next)}
            />
          )
        }

        return (
          <EntryField
            key={name}
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
      })}
    </div>
  )
}
