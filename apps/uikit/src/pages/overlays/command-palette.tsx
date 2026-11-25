import {
  Command,
  CommandCollection,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandKey,
  CommandList,
  CommandShortcut
} from "@bluechip/ui/components/command"
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { COMMAND_GROUPS, type CommandEntry } from "./data.ts"
import { Ticker } from "./layout.tsx"

export function CommandPalette({ inline = false }: { readonly inline?: boolean }) {
  return (
    <Command items={COMMAND_GROUPS}>
      <CommandInput placeholder="Search or type a command…" aria-label="Search commands" hint="esc" />
      <CommandEmpty>
        <Icon name="search" className="mb-1.5 text-g-300" />
        No results.
        <span className="text-label text-g-500">Try a ticker like NVDA, or ask in chat.</span>
      </CommandEmpty>
      <CommandList className={inline ? "max-h-[268px]" : ""}>
        {(group: (typeof COMMAND_GROUPS)[number]) => (
          <CommandGroup key={group.value} items={group.items}>
            <CommandGroupLabel>{group.value}</CommandGroupLabel>
            <CommandCollection>
              {(entry: CommandEntry) => (
                <CommandItem key={entry.value} value={entry} onClick={() => toast(entry.run)}>
                  {"ticker" in entry ? <Ticker symbol={entry.ticker} /> : <Icon name={entry.icon} />}
                  <span className="flex-1">{entry.label}</span>
                  {"price" in entry && <span className="text-label-sm text-g-500 tabular-nums">{entry.price}</span>}
                  {"shortcut" in entry && <CommandShortcut>{entry.shortcut}</CommandShortcut>}
                </CommandItem>
              )}
            </CommandCollection>
          </CommandGroup>
        )}
      </CommandList>
      <CommandFooter>
        <span>
          <CommandKey>↑</CommandKey>
          <CommandKey>↓</CommandKey>Move
        </span>
        <span>
          <CommandKey>↵</CommandKey>Open
        </span>
      </CommandFooter>
    </Command>
  )
}
