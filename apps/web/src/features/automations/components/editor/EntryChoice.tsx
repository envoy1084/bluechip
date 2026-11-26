import type { CheckContext } from "@bluechip/domain/automations/Entry"
import { RadioCard, RadioCardContent, RadioCardIcon, RadioGroup } from "@bluechip/ui/components/radio-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { type CatalogEntry, whyUnavailable } from "../../model/drafts.ts"
import { ENTRY_ICONS } from "./entryIcons.ts"

/**
 * Which trigger or action it is, as cards: each with its icon, its title and an example, or why it can't run for
 * this automation. Arrow keys move between them. The one in force stays pickable, even when it no longer could be.
 */
export function EntryChoice(
  { label, value, entries, examples, context, onChange }: Readonly<{
    label: string
    value: string
    entries: ReadonlyArray<CatalogEntry>
    examples: Readonly<Record<string, string>>
    context: CheckContext
    onChange: (type: string) => void
  }>
) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(type) => typeof type === "string" && type !== value && onChange(type)}
      className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2"
    >
      {entries.map((entry) => {
        const unavailable = entry.type === value ? null : whyUnavailable(entry, context)
        return (
          <RadioCard
            key={entry.type}
            value={entry.type}
            disabled={unavailable !== null}
            className={cn(
              "items-center gap-2.5 p-3 [&>span:last-child]:hidden",
              "data-checked:bg-white data-checked:shadow-[0_0_0_1.5px_var(--color-ink),0_3px_8px_-4px_rgba(10,11,13,.16)]"
            )}
          >
            <RadioCardIcon className="size-8 bg-g-100 text-g-600 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)] transition-colors duration-fast ease-brand group-data-checked/radio-card:bg-ink group-data-checked/radio-card:text-white">
              <Icon name={ENTRY_ICONS[entry.type as keyof typeof ENTRY_ICONS]} size={16} />
            </RadioCardIcon>
            <RadioCardContent className="flex-1">
              <strong>{entry.title}</strong>
              <span className="line-clamp-2">{unavailable ?? examples[entry.type]}</span>
            </RadioCardContent>
            <Icon
              name="check-circle"
              size={16}
              className="shrink-0 text-ink opacity-0 transition-opacity duration-fast ease-brand group-data-checked/radio-card:opacity-100"
            />
          </RadioCard>
        )
      })}
    </RadioGroup>
  )
}
