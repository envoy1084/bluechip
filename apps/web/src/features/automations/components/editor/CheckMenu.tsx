import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@bluechip/ui/components/dropdown-menu"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactElement, ReactNode } from "react"
import type { CatalogEntry } from "../../model/drafts.ts"
import { ENTRY_ICONS } from "./entryIcons.ts"

// The checks, in groups of what they read, so a long list reads at a glance.
const GROUPS: Readonly<Record<string, string>> = {
  marketOpen: "Market and time",
  pricesFresh: "Market and time",
  timeWindow: "Market and time",
  priceAbove: "Prices and holdings",
  priceBelow: "Prices and holdings",
  holdingAtLeast: "Prices and holdings",
  all: "Combine checks",
  any: "Combine checks",
  not: "Combine checks",
  judgment: "Ask the model"
}

const groupsOf = (entries: ReadonlyArray<CatalogEntry>) => {
  const groups: Array<{ readonly title: string; readonly entries: Array<CatalogEntry> }> = []
  for (const entry of entries) {
    const title = GROUPS[entry.type] ?? "More checks"
    const group = groups.find((each) => each.title === title)
    if (group === undefined) groups.push({ title, entries: [entry] })
    else group.entries.push(entry)
  }
  return groups
}

/**
 * The checks it can add or switch to, in a menu grouped by what they read, each with its icon and what it does; the
 * one in force (`value`) is marked. `trigger` is the button that opens it.
 */
export function CheckMenu(
  { entries, value, trigger, children, onPick }: Readonly<{
    entries: ReadonlyArray<CatalogEntry>
    value?: string | undefined
    trigger: ReactElement
    children: ReactNode
    onPick: (type: string) => void
  }>
) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(340px,calc(100vw-16px))] max-w-none">
        {groupsOf(entries).map((group, index) => (
          <DropdownMenuGroup key={group.title}>
            {index === 0 ? null : <DropdownMenuSeparator />}
            <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
            {group.entries.map((entry) => (
              <DropdownMenuItem
                key={entry.type}
                className="items-start gap-2.5 py-2 whitespace-normal"
                onClick={() => entry.type !== value && onPick(entry.type)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-px grid size-7 shrink-0 place-items-center rounded-md bg-g-100 text-g-600 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]",
                    entry.type === value && "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]"
                  )}
                >
                  <Icon name={ENTRY_ICONS[entry.type as keyof typeof ENTRY_ICONS]} size={14} />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium text-ink">{entry.title}</span>
                  <span className="text-label-sm leading-snug text-g-500">{entry.summary}</span>
                </span>
                {entry.type === value ?
                  (
                    <span className="mt-1 flex shrink-0 text-blue">
                      <Icon name="check" size={14} />
                    </span>
                  ) :
                  null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
