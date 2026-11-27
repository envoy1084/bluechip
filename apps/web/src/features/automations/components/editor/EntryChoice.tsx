import type { CheckContext } from "@bluechip/domain/automations/Entry"
import { RadioCard, RadioCardContent, RadioCardIcon, RadioGroup } from "@bluechip/ui/components/radio-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { type CatalogEntry, whyUnavailable } from "../../model/drafts.ts"
import { ENTRY_ICONS } from "./entryIcons.ts"

/**
 * Which trigger or action it is, as tiles: each with its icon, its title and an example, or why it can't run for
 * this automation (`sm`: the title alone, for the trade an `ask` proposes). Arrow keys move between them. The one in
 * force stays pickable, even when it no longer could be.
 */
export function EntryChoice(
  { label, value, entries, examples, context, size = "md", onChange }: Readonly<{
    label: string
    value: string
    entries: ReadonlyArray<CatalogEntry>
    examples?: Readonly<Record<string, string>>
    context: CheckContext
    size?: "sm" | "md"
    onChange: (type: string) => void
  }>
) {
  return (
    <div className="@container">
      <RadioGroup
        aria-label={label}
        value={value}
        onValueChange={(type) => typeof type === "string" && type !== value && onChange(type)}
        className={cn(
          "grid gap-2",
          size === "md" ? "grid-cols-1 @sm:grid-cols-2 @2xl:grid-cols-3" : "grid-cols-2 @lg:grid-cols-4"
        )}
      >
        {entries.map((entry) => {
          const unavailable = entry.type === value ? null : whyUnavailable(entry, context)
          return (
            <RadioCard
              key={entry.type}
              value={entry.type}
              disabled={unavailable !== null}
              className={cn(
                "relative min-w-0 items-center gap-2.5 [&>span:last-child]:hidden",
                size === "md" ? "p-3 pr-7" : "px-2.5 py-2"
              )}
            >
              <RadioCardIcon
                className={cn(
                  "bg-g-100 text-g-600 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)] transition-colors duration-fast ease-brand",
                  "group-data-checked/radio-card:bg-blue group-data-checked/radio-card:text-white",
                  "group-data-checked/radio-card:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_1px_2px_rgba(20,50,160,.2)]",
                  size === "md" ? "size-9" : "size-7"
                )}
              >
                <Icon name={ENTRY_ICONS[entry.type as keyof typeof ENTRY_ICONS]} size={size === "md" ? 17 : 14} />
              </RadioCardIcon>
              <RadioCardContent className="flex-1">
                <strong className={cn(size === "sm" && "text-label!")}>{entry.title}</strong>
                {size === "md" ?
                  <span className="line-clamp-2">{unavailable ?? examples?.[entry.type]}</span> :
                  null}
              </RadioCardContent>
              {size === "md" ?
                (
                  <Icon
                    name="check-circle"
                    size={16}
                    className="absolute top-2.5 right-2.5 text-blue opacity-0 transition-opacity duration-fast ease-brand group-data-checked/radio-card:opacity-100"
                  />
                ) :
                null}
            </RadioCard>
          )
        })}
      </RadioGroup>
    </div>
  )
}
