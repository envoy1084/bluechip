import { Button } from "@bluechip/ui/components/button"
import { CommandDialog, CommandDialogContent, CommandDialogTrigger } from "@bluechip/ui/components/command"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from "@bluechip/ui/components/context-menu"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@bluechip/ui/components/dropdown-menu"
import { Kbd } from "@bluechip/ui/components/kbd"
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { CommandPalette } from "./command-palette.tsx"
import { Section, Ticker } from "./layout.tsx"

export function MenuSections({ open }: { readonly open: string | undefined }) {
  return (
    <>
      <Section
        id="dropdown-menu"
        title="Dropdown menu"
        base="Menu"
        purpose="Actions and settings behind a button: groups, check items, submenus and shortcuts."
      >
        <AccountMenu defaultOpen={open === "dropdown-menu"} />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Agent actions" />}>
            <Icon name="more" size={18} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast("Opening limits editor")}>
              <Icon name="edit" />Edit limits
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast("Rebalancer paused")}>
              <Icon name="pause" />Pause agent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast("Rebalancer copy created")}>
              <Icon name="copy" />Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => toast("Rebalancer removed")}>
              <Icon name="trash" />Remove agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section
        id="context-menu"
        title="Context menu"
        base="ContextMenu"
        purpose="Actions for the thing under the pointer. Right-click or long-press."
      >
        <ContextMenu>
          <ContextMenuTrigger className="w-full max-w-[420px] cursor-context-menu rounded-lg bg-white p-[18px] shadow-e2 transition-shadow duration-base ease-brand hover:shadow-e3 data-popup-open:shadow-[0_0_0_1.5px_var(--color-blue),var(--shadow-e3)]">
            <div className="flex items-center gap-3">
              <Ticker symbol="NVDA" />
              <div className="grid flex-1">
                <strong className="text-[14.5px] font-semibold">Nvidia</strong>
                <span className="text-label text-g-500">12.4 shares · Rebalancer</span>
              </div>
              <div className="grid justify-items-end">
                <b className="text-body tabular-nums">$2,249.61</b>
                <span className="text-label font-[550] text-gain tabular-nums">+2.31%</span>
              </div>
            </div>
            <p className="mt-3.5 flex items-center gap-2 border-t border-dashed border-g-200 pt-3 text-label-sm text-g-500">
              <Icon name="hand" size={14} />Right-click this card
            </p>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuGroup>
              <ContextMenuLabel>NVDA · Nvidia</ContextMenuLabel>
              <ContextMenuItem onClick={() => toast("Opening buy")}>
                <Icon name="plus" />Buy more
              </ContextMenuItem>
              <ContextMenuItem onClick={() => toast("Opening sell")}>
                <Icon name="minus" />Sell
              </ContextMenuItem>
              <ContextMenuItem onClick={() => toast("Opening Stop-loss guard")}>
                <Icon name="shield" />Set a stop-loss
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Icon name="agent" />Ask an agent
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {([["scales", "Rebalancer"], ["target", "Stock picker"], ["calendar", "Weekly buyer"]] as const).map((
                  [icon, name]
                ) => (
                  <ContextMenuItem key={name} onClick={() => toast(`Asking ${name} about NVDA`)}>
                    <Icon name={icon} />
                    {name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem onClick={() => toast("Copied NVDA")}>
              <Icon name="copy" />Copy ticker<ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => toast("NVDA hidden. Undo from Settings.")}>
              <Icon name="eye-off" />Hide from portfolio
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </Section>

      <Section
        id="command"
        title="Command"
        base="Autocomplete + Dialog"
        purpose="Search everything and jump. Open it from anywhere with ⌘K or Ctrl+K."
      >
        <div className="w-full max-w-[420px] overflow-hidden rounded-lg shadow-e3">
          <CommandPalette inline />
        </div>
        <div className="grid justify-items-center gap-2">
          <CommandDialog defaultOpen={open === "command"}>
            <CommandDialogTrigger className="inline-flex h-10 w-[min(100%,300px)] cursor-pointer items-center gap-2.5 rounded-md bg-white pr-2 pl-3 text-body-sm text-g-500 surface-field hover:text-g-700">
              <Icon name="search" />
              <span className="flex-1 text-left">Search bluechip</span>
              <Kbd>⌘K</Kbd>
            </CommandDialogTrigger>
            <CommandDialogContent>
              <CommandPalette />
            </CommandDialogContent>
          </CommandDialog>
          <p className="text-label text-g-500">
            Or press <Kbd>⌘</Kbd> <Kbd>K</Kbd> anywhere on this page.
          </p>
        </div>
      </Section>

      <Section
        id="toast"
        title="Toast"
        base="Toast"
        purpose="Brief confirmation after an action. Stacks at the corner, expands on hover, pauses while you read."
      >
        <Button
          variant="secondary"
          onClick={() => toast("Rebalancer paused", { description: "It won't trade until you turn it back on." })}
        >
          Default
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.success("Trade approved", { description: "Bought 2 NVDA for $362.84." })}
        >
          <Icon name="check-circle" size={16} />Success
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.error("Your limit stopped this trade", {
              description: "Stock picker tried to spend $410. Max per trade is $250."
            })}
        >
          <Icon name="error" size={16} />Error
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast("Agent removed", {
              description: "Weekly buyer won't run again.",
              action: { label: "Undo", onClick: () => toast.success("Weekly buyer is back") }
            })}
        >
          <Icon name="refresh" size={16} />With action
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void toast.promise(new Promise((resolve) => setTimeout(resolve, 1800)), {
              loading: "Locking limits…",
              description: "Confirm with Face ID on your device.",
              success: "Limits locked",
              error: "Couldn't lock limits"
            })}
        >
          <Icon name="hourglass" size={16} />Loading → done
        </Button>
      </Section>
    </>
  )
}

export function AccountMenu({ defaultOpen }: { readonly defaultOpen: boolean }) {
  const [balances, setBalances] = useState(true)
  const [compact, setCompact] = useState(false)
  const [currency, setCurrency] = useState("usd")
  return (
    <DropdownMenu defaultOpen={defaultOpen} modal={!defaultOpen}>
      <DropdownMenuTrigger render={<Button variant="secondary" />}>
        <Icon name="user" size={16} />Alex<Icon name="chevron-down" size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[240px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toast("Opening profile")}>
            <Icon name="user" />Profile<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast("Opening Face ID settings")}>
            <Icon name="face-id" />Face ID & passkeys
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast("Opening settings")}>
            <Icon name="settings" />Settings<DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={balances} onCheckedChange={setBalances}>
            Show balances
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={compact} onCheckedChange={setCompact}>
            Compact rows
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Icon name="globe" />Display currency
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={currency} onValueChange={(value) => setCurrency(String(value))}>
                <DropdownMenuRadioItem value="usd">US dollar</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="eur">Euro</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="gbp">British pound</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Icon name="download" />Download statement
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => toast("Logged out")}>
          <Icon name="logout" />Log out<DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
