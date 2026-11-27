import type { Condition } from "@bluechip/domain/automations/Automation"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { catalogEntry, freshEntry, offered } from "../../model/drafts.ts"
import { CheckMenu } from "./CheckMenu.tsx"
import { CheckRow } from "./CheckRow.tsx"
import type { EditorContext } from "./editorContext.ts"
import { EntryEditor } from "./EntryEditor.tsx"
import { ENTRY_ICONS } from "./entryIcons.ts"

// The checks most automations want, offered a click away while there are none.
const SUGGESTED = ["marketOpen", "holdingAtLeast", "priceBelow", "timeWindow"]

/**
 * The checks that must all hold for it to act, each a row read as it holds, joined by "and"; Add a check offers
 * every check it can take, grouped. With none, the usual ones are a click away, and it acts every time.
 */
export function ConditionRows(
  { conditions, context, problemOf, idOf, onChange }: Readonly<{
    conditions: ReadonlyArray<Condition>
    context: EditorContext
    problemOf: (index: number) => (field: string | null) => string | undefined
    idOf: (index: number) => string
    onChange: (conditions: ReadonlyArray<Condition>) => void
  }>
) {
  const stock = context.stocks[0]!.symbol
  // Conditions have no ids of their own; these keep each one's fields in place as others come and go.
  const [keys, setKeys] = useState(() => conditions.map(() => crypto.randomUUID()))
  const entries = offered("condition", context.check)

  const add = (type: string) => {
    setKeys([...keys, crypto.randomUUID()])
    onChange([...conditions, freshEntry("condition", type, stock) as Condition])
  }
  const remove = (index: number) => {
    setKeys(keys.filter((_, at) => at !== index))
    onChange(conditions.filter((_, at) => at !== index))
  }
  const set = (index: number, condition: Condition) =>
    onChange(conditions.map((each, at) => at === index ? condition : each))

  const addMenu = (label: string) => (
    <CheckMenu
      entries={entries}
      trigger={<Button variant="secondary" size="sm" className="justify-self-start" />}
      onPick={add}
    >
      <Icon name="plus" size={14} />
      {label}
    </CheckMenu>
  )

  if (conditions.length === 0) {
    const suggested = SUGGESTED.filter((type) => entries.some((entry) => entry.type === type))
    return (
      <div className="grid gap-3">
        <p className="text-label text-g-500">None yet, so it acts every time it starts. Add a check to narrow it.</p>
        <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
          {suggested.map((type) => {
            const { title, summary } = catalogEntry("condition", type)
            return (
              <button
                key={type}
                type="button"
                aria-label={`Add the check ${title}`}
                onClick={() => add(type)}
                className="group/add flex cursor-pointer items-start gap-2.5 rounded-lg bg-white p-3 text-left surface-field outline-none transition-shadow duration-fast ease-brand hover:shadow-[0_0_0_1px_var(--color-blue),0_2px_6px_-3px_rgba(42,91,255,.2)] focus-visible:shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42,91,255,.14)]"
              >
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-md bg-g-100 text-g-600 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)] transition-colors duration-fast ease-brand group-hover/add:bg-blue-50 group-hover/add:text-blue"
                >
                  <Icon name={ENTRY_ICONS[type as Condition["type"]]} size={15} />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-body-sm font-semibold text-ink">{title}</span>
                  <span className="text-label-sm leading-snug text-g-500">{summary}</span>
                </span>
                <Icon
                  name="plus"
                  size={15}
                  className="mt-0.5 shrink-0 text-g-400 group-hover/add:text-blue"
                />
              </button>
            )
          })}
        </div>
        {addMenu("More checks")}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {conditions.map((condition, index) => {
        const problemAt = problemOf(index)
        return (
          <div key={`${keys[index]}-${condition.type}`} className="grid gap-4">
            {index === 0 ? null : (
              <div aria-hidden className="flex items-center gap-2.5">
                <span className="h-px flex-1 bg-g-100" />
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-caption font-semibold text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
                  and
                </span>
                <span className="h-px flex-1 bg-g-100" />
              </div>
            )}
            <section
              id={idOf(index)}
              tabIndex={-1}
              aria-label={`Condition ${index + 1}`}
              className="scroll-mt-[84px] rounded-md outline-none focus-visible:shadow-[0_0_0_2px_var(--color-blue)]"
            >
              <CheckRow
                label={`condition ${index + 1}`}
                value={condition}
                entries={entries}
                context={context}
                problem={problemAt(null)}
                onChange={(type) => set(index, freshEntry("condition", type, stock) as Condition)}
                onRemove={() => remove(index)}
              >
                <EntryEditor
                  kind="condition"
                  value={condition}
                  context={context}
                  problemOf={problemAt}
                  onChange={(next) => set(index, next as Condition)}
                />
              </CheckRow>
            </section>
          </div>
        )
      })}
      <div className="border-t border-g-100 pt-4">{addMenu("Add a check")}</div>
    </div>
  )
}
