import type { Condition } from "@bluechip/domain/automations/Automation"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { catalogEntry, freshEntry, offered } from "../../model/drafts.ts"
import type { EditorContext } from "./editorContext.ts"
import { EntryEditor, EntryTypeSelect } from "./EntryEditor.tsx"
import { ENTRY_ICONS } from "./entryIcons.ts"
import { PartProblem } from "./PartProblem.tsx"

// The checks most automations want, offered in one click while there are none.
const SUGGESTED = ["marketOpen", "holdingAtLeast", "priceBelow", "timeWindow"]

/**
 * The checks that must hold for it to act, each a row with its kind, its fields and Remove; with none, Add a check
 * and the usual ones a click away.
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
  const addUnused = () =>
    add(entries.find((entry) => !conditions.some((each) => each.type === entry.type))?.type ?? "holdingAtLeast")
  const remove = (index: number) => {
    setKeys(keys.filter((_, at) => at !== index))
    onChange(conditions.filter((_, at) => at !== index))
  }
  const set = (index: number, condition: Condition) =>
    onChange(conditions.map((each, at) => at === index ? condition : each))

  if (conditions.length === 0) {
    const suggested = SUGGESTED.filter((type) => entries.some((entry) => entry.type === type))
    return (
      <div className="grid gap-3">
        <button
          type="button"
          onClick={addUnused}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-g-300 px-3.5 py-3 text-left text-label text-g-600 outline-none hover:border-g-500 hover:text-ink focus-visible:border-blue focus-visible:text-ink"
        >
          <Icon name="plus" size={15} />
          <span>
            <b className="font-semibold">Add a check</b>, or leave it empty to act every time.
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-label-sm text-g-500">Often used</span>
          {suggested.map((type) => {
            const { title } = catalogEntry("condition", type)
            return (
              <Button
                key={type}
                variant="secondary"
                size="sm"
                aria-label={`Add the check ${title}`}
                onClick={() => add(type)}
              >
                <Icon name={ENTRY_ICONS[type as Condition["type"]]} size={14} />
                {title}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-2.5">
      {conditions.map((condition, index) => {
        const problemAt = problemOf(index)
        return (
          <section
            key={`${keys[index]}-${condition.type}`}
            id={idOf(index)}
            tabIndex={-1}
            aria-label={`Condition ${index + 1}`}
            className="grid scroll-mt-[84px] gap-3 rounded-[12px] p-3 outline-none surface-well focus-visible:shadow-[0_0_0_1.5px_var(--color-blue)]"
          >
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-md bg-white text-g-600 shadow-[0_0_0_1px_rgba(10,11,13,.08)]"
              >
                <Icon name={ENTRY_ICONS[condition.type]} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <EntryTypeSelect
                  label={`Condition ${index + 1}`}
                  value={condition.type}
                  entries={entries}
                  onChange={(type) => set(index, freshEntry("condition", type, stock) as Condition)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove condition ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Icon name="close" size={15} />
              </Button>
            </div>
            <PartProblem message={problemAt(null)} />
            <EntryEditor
              kind="condition"
              value={condition}
              context={context}
              problemOf={problemAt}
              onChange={(next) => set(index, next as Condition)}
            />
          </section>
        )
      })}
      <Button variant="ghost" size="sm" className="justify-self-start" onClick={addUnused}>
        <Icon name="plus" size={14} />Add a check
      </Button>
    </div>
  )
}
