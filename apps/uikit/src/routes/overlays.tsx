import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@bluechip/ui/components/alert-dialog"
import { Badge } from "@bluechip/ui/components/badge"
import { Button } from "@bluechip/ui/components/button"
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogContent,
  CommandDialogTrigger,
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
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@bluechip/ui/components/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@bluechip/ui/components/drawer"
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@bluechip/ui/components/hover-card"
import { Input } from "@bluechip/ui/components/input"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Kbd } from "@bluechip/ui/components/kbd"
import { Label } from "@bluechip/ui/components/label"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger
} from "@bluechip/ui/components/popover"
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@bluechip/ui/components/sheet"
import { toast, Toaster } from "@bluechip/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@bluechip/ui/components/tooltip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, useEffect, useState } from "react"

// `?open=<id>` opens one overlay on load, so a headless screenshot can show it.
export const Route = createFileRoute("/overlays")({
  component: KitOverlays,
  validateSearch: (search: Record<string, unknown>): { readonly open?: string } =>
    typeof search.open === "string" ? { open: search.open } : {}
})

const LIMITS: ReadonlyArray<readonly [string, string]> = [
  ["Stocks allowed", "NVDA · AAPL · MSFT"],
  ["Spend per day", "$250"],
  ["Max per trade", "$100"],
  ["Max in one stock", "25%"],
  ["Cash reserve", "$200"],
  ["Fair price check", "Within 1%"],
  ["Approval needed above", "$500"],
  ["Rebalance only", "Yes"]
]

function Limits({ count = LIMITS.length }: { readonly count?: number }) {
  return (
    <dl className="grid">
      {LIMITS.slice(0, count).map(([term, value]) => (
        <div
          key={term}
          className="flex items-center justify-between gap-3 border-b border-g-100 py-[9px] text-[13.5px] last:border-b-0"
        >
          <dt className="text-g-500">{term}</dt>
          <dd className="font-[550] tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AgentTile({ icon, size = "md" }: { readonly icon: IconName; readonly size?: "md" | "lg" }) {
  return (
    <span
      className={size === "lg" ?
        "grid size-12 place-items-center rounded-[14px] bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]" :
        "grid size-10 place-items-center rounded-[12px] bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]"}
    >
      <Icon name={icon} size={size === "lg" ? 24 : 20} />
    </span>
  )
}

function Ticker({ symbol }: { readonly symbol: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-[5px] bg-ink px-1.5 text-caption-sm font-bold tracking-wide text-white">
      {symbol}
    </span>
  )
}

function Section(
  { id, title, purpose, base, children }: {
    readonly id: string
    readonly title: string
    readonly purpose: string
    readonly base: string
    readonly children: ReactNode
  }
) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid gap-4 border-t border-g-100 pt-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id={`${id}-title`} className="text-title-2 font-semibold">{title}</h2>
          <p className="max-w-[56ch] text-body-sm text-g-600">{purpose}</p>
        </div>
        <span className="rounded-full bg-g-100 px-2.5 py-0.5 text-caption font-medium text-g-600">{base}</span>
      </header>
      <div className="flex min-h-40 flex-wrap items-center justify-center gap-3 rounded-lg bg-white p-6 shadow-e1">
        {children}
      </div>
    </section>
  )
}

const COMMAND_GROUPS = [
  {
    value: "Suggestions",
    items: [
      {
        value: "create",
        label: "Create an agent",
        icon: "plus",
        shortcut: "⌘N",
        run: "Opening chat: “Create an agent that…”"
      },
      { value: "deposit", label: "Deposit cash", icon: "cash", run: "Opening deposit" },
      { value: "ask", label: "Ask about my portfolio", icon: "chat", run: "Opening chat" }
    ]
  },
  {
    value: "Stocks",
    items: [
      { value: "NVDA", label: "Nvidia", ticker: "NVDA", price: "$181.42", run: "Opening Nvidia" },
      { value: "AAPL", label: "Apple", ticker: "AAPL", price: "$241.18", run: "Opening Apple" },
      { value: "MSFT", label: "Microsoft", ticker: "MSFT", price: "$455.60", run: "Opening Microsoft" }
    ]
  },
  {
    value: "Agents",
    items: [
      { value: "rebalancer", label: "Rebalancer", icon: "scales", run: "Opening Rebalancer" },
      { value: "weekly-buyer", label: "Weekly buyer", icon: "calendar", run: "Opening Weekly buyer" }
    ]
  },
  {
    value: "Settings",
    items: [
      { value: "face-id", label: "Face ID & passkeys", icon: "face-id", run: "Opening Face ID settings" },
      { value: "pause", label: "Pause all agents", icon: "pause", shortcut: "⇧⌘P", run: "All agents paused" }
    ]
  }
] as const

type CommandEntry = (typeof COMMAND_GROUPS)[number]["items"][number]

function CommandPalette({ inline = false }: { readonly inline?: boolean }) {
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

function KitOverlays() {
  const { open } = Route.useSearch()
  const [gap, setGap] = useState(["1%"])

  useEffect(() => {
    if (open !== "toast") return
    toast.error("Your limit stopped this trade", {
      description: "Stock picker tried to spend $410. Max per trade is $250."
    })
    toast("Rebalancer paused", { description: "It won't trade until you turn it back on." })
    toast.success("Trade approved", { description: "Bought 2 NVDA for $362.84.", duration: 0 })
  }, [open])

  return (
    <TooltipProvider>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:px-10">
        <div className="grid gap-3">
          <h1 className="text-display-3 font-semibold">Overlays</h1>
          <p className="max-w-[64ch] text-body-lg text-g-600">
            Everything that floats above the page. Modals trap focus, lock scroll and give focus back; anchored panels
            follow their trigger. Esc always closes the top layer.
          </p>
        </div>

        <Section
          id="dialog"
          title="Dialog"
          base="Dialog"
          purpose="A focused task on top of the page. Traps focus, closes on Esc or outside click, gives focus back."
        >
          <Dialog defaultOpen={open === "dialog"}>
            <DialogTrigger render={<Button variant="secondary" />}>
              <Icon name="edit" size={16} />Rename agent
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename agent</DialogTitle>
                <DialogDescription>Only you see this name. Its limits stay the same.</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="grid gap-1.5">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input id="agent-name" defaultValue="Rebalancer" />
                </div>
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
                <DialogClose render={<Button />} onClick={() => toast.success("Agent renamed")}>Save name</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog defaultOpen={open === "dialog-scroll"}>
            <DialogTrigger render={<Button variant="outline" />}>
              <Icon name="shield" size={16} />Review limits
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rebalancer's limits</DialogTitle>
                <DialogDescription>Locked with Face ID on Nov 2. Your agent can never go past these.</DialogDescription>
              </DialogHeader>
              <DialogBody scrollable>
                <Limits />
                <p className="text-label text-g-500">
                  Limits are checked onchain before every trade. If a trade would break one, it doesn't happen and you
                  get a note in Activity.
                </p>
                <p className="text-label text-g-500">
                  To change a limit, edit it and confirm with Face ID. The agent pauses until you do.
                </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button variant="secondary" />}>Close</DialogClose>
                <DialogClose render={<Button />} onClick={() => toast("Opening limits editor")}>
                  <Icon name="face-id" size={16} />Edit limits
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        <Section
          id="alert-dialog"
          title="Alert dialog"
          base="AlertDialog"
          purpose="Confirms something that can't be undone. Outside clicks don't close it; focus starts on the safe choice."
        >
          <AlertDialog defaultOpen={open === "alert-dialog"}>
            <AlertDialogTrigger render={<Button variant="danger" />}>
              <Icon name="trash" size={16} />Remove agent
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogIcon name="trash" />
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Rebalancer?</AlertDialogTitle>
                <AlertDialogDescription>
                  It stops right away and can't trade again. Your stocks and cash stay in your account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep agent</AlertDialogCancel>
                <AlertDialogAction onClick={() => toast.success("Rebalancer removed")}>Remove agent</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>

        <Section
          id="sheet"
          title="Sheet"
          base="Sheet (Dialog)"
          purpose="A panel that slides in from an edge for details you can read without leaving the page."
        >
          <Sheet defaultOpen={open === "sheet"}>
            <SheetTrigger render={<Button variant="secondary" />}>
              Agent details<Icon name="arrow-right" size={16} />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <AgentTile icon="scales" />
                  <div className="grid gap-0.5">
                    <SheetTitle>Rebalancer</SheetTitle>
                    <Badge variant="success">Running</Badge>
                  </div>
                </div>
              </SheetHeader>
              <SheetBody>
                <SheetDescription>Keeps your mix on target. Only rebalances, never adds cash.</SheetDescription>
                <div className="grid gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold text-g-400">Limits</span>
                    <span className="inline-flex items-center gap-1 text-caption font-[550] text-gain">
                      <Icon name="lock" size={12} />Locked with Face ID
                    </span>
                  </div>
                  <Limits />
                </div>
              </SheetBody>
              <SheetFooter>
                <SheetClose render={<Button variant="danger" />} onClick={() => toast("Rebalancer removed")}>
                  <Icon name="trash" size={16} />Remove agent
                </SheetClose>
                <SheetClose render={<Button variant="secondary" />} onClick={() => toast("Opening limits editor")}>
                  Edit limits
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Sheet defaultOpen={open === "sheet-left"}>
            <SheetTrigger render={<Button variant="outline" />}>
              <Icon name="sidebar" size={16} />Open menu
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>bluechip</SheetTitle>
              </SheetHeader>
              <nav aria-label="Main" className="grid gap-0.5 p-3">
                {(["home", "portfolio", "agents", "activity", "approvals", "settings"] as const).map((name, i) => (
                  <SheetClose
                    key={name}
                    aria-current={i === 0 ? "page" : undefined}
                    className="flex h-[38px] cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-body-sm font-medium text-g-600 capitalize hover:bg-g-100 hover:text-ink aria-[current=page]:bg-white aria-[current=page]:text-ink aria-[current=page]:shadow-e1 aria-[current=page]:[&>svg]:text-blue"
                  >
                    <Icon name={name} size={18} className="text-g-400" />
                    {name}
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          {(["top", "bottom"] as const).map((side) => (
            <Sheet key={side} defaultOpen={open === `sheet-${side}`}>
              <SheetTrigger render={<Button variant="ghost" />}>From the {side}</SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Prices are a few seconds old</SheetTitle>
                  <SheetDescription>
                    Your agents always use a fresh price and the fair price check before they trade.
                  </SheetDescription>
                </SheetHeader>
                <SheetFooter className="justify-end">
                  <SheetClose render={<Button variant="secondary" />}>Got it</SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          ))}
        </Section>

        <Section
          id="drawer"
          title="Drawer"
          base="Drawer"
          purpose="A bottom sheet for phones. Swipe it down, tap outside or press Esc to dismiss."
        >
          <Drawer defaultOpen={open === "drawer"}>
            <DrawerTrigger render={<Button />}>
              <Icon name="approvals" size={16} />Review pending trade
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <span className="mb-1">
                  <AgentTile icon="target" size="lg" />
                </span>
                <DrawerTitle>Approve this trade?</DrawerTitle>
                <DrawerDescription>
                  Stock picker wants to buy 2 <Ticker symbol="NVDA" /> for <b className="tabular-nums">$362.84</b>.
                </DrawerDescription>
              </DrawerHeader>
              <ul className="grid gap-2 rounded-md bg-g-50 px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]">
                {[
                  "Inside spend per day ($250 left after this: $87)",
                  "Fair price check passed (0.2% from market)",
                  "Above $300, so it needs you"
                ].map((line, i) => (
                  <li key={line} className="flex items-start gap-[9px] text-label text-g-700">
                    <Icon
                      name={i === 2 ? "hand" : "check-circle"}
                      size={16}
                      className={i === 2 ? "mt-px text-blue" : "mt-px text-gain"}
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <DrawerFooter>
                <DrawerClose render={<Button size="lg" />} onClick={() => toast.success("Trade approved")}>
                  <Icon name="face-id" size={18} />Approve with Face ID
                </DrawerClose>
                <DrawerClose
                  render={<Button variant="ghost" />}
                  onClick={() => toast("Trade declined. Stock picker will look again tomorrow.")}
                >
                  Decline
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </Section>

        <Section
          id="popover"
          title="Popover"
          base="Popover"
          purpose="Rich content anchored to a trigger: a short explainer or a small form. Not modal."
        >
          <Popover defaultOpen={open === "popover"}>
            <PopoverTrigger render={<Button variant="secondary" />}>
              <Icon name="info" size={16} />Fair price check
            </PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>
                <span className="grid size-7 place-items-center rounded-sm bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
                  <Icon name="scales" size={16} />
                </span>
                Fair price check
              </PopoverTitle>
              <PopoverDescription>
                Before any trade, bluechip compares the price to the market. If it's more than {gap[0]}{" "}
                off, the trade doesn't happen.
              </PopoverDescription>
              <div className="flex items-center justify-between gap-3">
                <span className="text-label font-semibold">Allowed gap</span>
                <ToggleGroup
                  aria-label="Allowed gap"
                  value={gap}
                  onValueChange={(next) => next.length > 0 && setGap(next)}
                >
                  {["0.5%", "1%", "2%"].map((value) => (
                    <ToggleGroupItem key={value} value={value} size="sm">{value}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>
              Approval amount<Icon name="chevron-down" size={16} />
            </PopoverTrigger>
            <PopoverContent align="end" aria-label="Approval amount">
              <div className="grid gap-1.5">
                <Label htmlFor="approval-amount">Ask me above</Label>
                <InputGroup>
                  <InputGroupText>$</InputGroupText>
                  <InputGroupInput id="approval-amount" defaultValue="500" inputMode="decimal" />
                </InputGroup>
                <p className="text-label text-g-500">Trades above this wait for Face ID.</p>
              </div>
              <div className="flex justify-end gap-2">
                <PopoverClose render={<Button variant="ghost" size="sm" />}>Cancel</PopoverClose>
                <PopoverClose render={<Button size="sm" />} onClick={() => toast.success("Approval amount saved")}>
                  Save
                </PopoverClose>
              </div>
            </PopoverContent>
          </Popover>
        </Section>

        <Section
          id="hover-card"
          title="Hover card"
          base="PreviewCard"
          purpose="A preview on hover or focus, for people who want a peek before they click."
        >
          <p className="max-w-[44ch] text-center text-body text-g-700">
            Last trade by{" "}
            <HoverCard defaultOpen={open === "hover-card"}>
              <HoverCardTrigger
                href="#hover-card"
                className="font-[550] text-blue underline decoration-blue/30 underline-offset-3 hover:decoration-blue"
              >
                Rebalancer
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="flex items-start gap-3">
                  <AgentTile icon="scales" />
                  <div className="grid flex-1 gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[14.5px] font-semibold">Rebalancer</strong>
                      <Badge variant="success">Running</Badge>
                    </div>
                    <p className="text-label leading-snug text-g-600">
                      Keeps your mix on target. Only rebalances, never adds cash.
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 border-t border-g-100 pt-3">
                  {[["Trades this week", "6"], ["Stopped by limits", "1"], ["Since", "Oct 2026"]].map((
                    [term, value]
                  ) => (
                    <div key={term} className="grid gap-px">
                      <dt className="text-[11.5px] text-g-500">{term}</dt>
                      <dd className="text-body-sm font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </HoverCardContent>
            </HoverCard>: sold 1 <Ticker symbol="TSLA" /> to bring Tesla back under 25%.
          </p>
        </Section>

        <Section
          id="tooltip"
          title="Tooltip"
          base="Tooltip"
          purpose="A short label for an icon-only control. Shows on hover after a beat, and on keyboard focus right away."
        >
          {([
            ["pause", "Pause agent", "top", undefined],
            ["copy", "Copy address", "bottom", undefined],
            ["refresh", "Refresh prices", "left", "R"],
            ["help", "How limits work", "right", undefined]
          ] as const).map(([icon, label, side, shortcut], i) => (
            <Tooltip key={label} defaultOpen={open === "tooltip" && i === 2}>
              <TooltipTrigger render={<Button variant="secondary" size="icon" aria-label={label} />}>
                <Icon name={icon} size={18} />
              </TooltipTrigger>
              <TooltipContent side={side} shortcut={shortcut}>{label}</TooltipContent>
            </Tooltip>
          ))}
        </Section>

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
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

function AccountMenu({ defaultOpen }: { readonly defaultOpen: boolean }) {
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
