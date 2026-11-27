import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import type { ReactNode } from "react"
import { type CatalogEntry, catalogEntry, type Entry } from "../../model/drafts.ts"
import { CheckMenu } from "./CheckMenu.tsx"
import type { EditorContext } from "./editorContext.ts"
import { ENTRY_ICONS } from "./entryIcons.ts"
import { PartProblem } from "./PartProblem.tsx"

/**
 * One check, read as it will hold: its icon, its title and what it says in the sentence ("While the market is
 * open"); Change swaps it for another check, Remove takes it away; its fields (`children`) under it.
 */
export function CheckRow(
  { label, value, entries, context, problem, onChange, onRemove, children }: Readonly<{
    /** Names it for Change and Remove: "condition 1". */
    label: string
    value: Entry
    /** The checks it can become. */
    entries: ReadonlyArray<CatalogEntry>
    context: EditorContext
    /** What about the check as a whole keeps it from running. */
    problem?: string | undefined
    onChange: (type: string) => void
    onRemove?: (() => void) | undefined
    children: ReactNode
  }>
) {
  const entry = catalogEntry("condition", value.type)
  const phrase = entry.describe(value.config as never, { name: context.nameOf })
  const said = phrase.length === 0 ? entry.summary : phrase[0]!.toUpperCase() + phrase.slice(1)

  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]"
        >
          <Icon name={ENTRY_ICONS[value.type as keyof typeof ENTRY_ICONS]} size={17} />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5 pt-px">
          <span className="text-[14px] font-semibold text-ink">{entry.title}</span>
          <span className="line-clamp-2 text-label text-g-500">{said}</span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <CheckMenu
            entries={entries}
            value={value.type}
            trigger={<Button variant="ghost" size="sm" aria-label={`Change ${label}`} />}
            onPick={onChange}
          >
            Change
          </CheckMenu>
          {onRemove === undefined ?
            null :
            (
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={onRemove}>
                <Icon name="close" size={15} />
              </Button>
            )}
        </span>
      </div>
      <PartProblem message={problem} />
      <div className="empty:hidden sm:pl-12">{children}</div>
    </div>
  )
}
