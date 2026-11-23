import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@bluechip/ui/components/accordion"
import { Badge } from "@bluechip/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@bluechip/ui/components/breadcrumb"
import { Button } from "@bluechip/ui/components/button"
import { Carousel, CarouselContent, CarouselControls, CarouselItem } from "@bluechip/ui/components/carousel"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@bluechip/ui/components/dropdown-menu"
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger
} from "@bluechip/ui/components/menubar"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerClassName
} from "@bluechip/ui/components/navigation-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  paginationRange
} from "@bluechip/ui/components/pagination"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@bluechip/ui/components/resizable"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "@bluechip/ui/components/sidebar"
import { Tabs, TabsCount, TabsList, TabsPanel, TabsTab } from "@bluechip/ui/components/tabs"
import { toast, Toaster } from "@bluechip/ui/components/toast"
import { TooltipProvider } from "@bluechip/ui/components/tooltip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, useState } from "react"

export const Route = createFileRoute("/kit/navigation")({ component: KitNavigation })

const AGENTS: ReadonlyArray<
  { readonly id: string; readonly name: string; readonly icon: IconName; readonly say: string }
> = [
  {
    id: "rebalancer",
    name: "Rebalancer",
    icon: "scales",
    say: "Keeps your mix on target. Only rebalances, never adds cash."
  },
  {
    id: "stock-picker",
    name: "Stock picker",
    icon: "target",
    say: "Buys from a short list you choose, inside your limits."
  },
  {
    id: "weekly-buyer",
    name: "Weekly buyer",
    icon: "calendar",
    say: "Buys the same amount every week, on the day you pick."
  },
  {
    id: "stop-loss",
    name: "Stop-loss guard",
    icon: "shield",
    say: "Sells a stock when it falls past the line you set."
  },
  {
    id: "custom",
    name: "Your own",
    icon: "chat",
    say: "Describe it in chat. bluechip turns it into limits you approve."
  }
]

const LIMITS: ReadonlyArray<readonly [string, string]> = [
  ["Spend per day", "$250"],
  ["Max per trade", "$100"],
  ["Max in one stock", "25%"],
  ["Cash reserve", "$200"],
  ["Fair price check", "Within 1%"],
  ["Approval needed above", "$500"],
  ["Stocks allowed", "NVDA · AAPL · MSFT"],
  ["Rebalance only", "Yes"]
]

function Limits({ rows }: { readonly rows: ReadonlyArray<readonly [string, string]> }) {
  return (
    <dl className="grid">
      {rows.map(([term, value]) => (
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

function IconTile({ icon }: { readonly icon: IconName }) {
  return (
    <span className="grid size-[30px] shrink-0 place-items-center rounded-sm bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
      <Icon name={icon} size={18} />
    </span>
  )
}

function Section(
  { id, title, purpose, base, flush = false, children }: {
    readonly id: string
    readonly title: string
    readonly purpose: string
    readonly base: string
    readonly flush?: boolean
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
      <div
        className={flush
          ? "overflow-hidden rounded-lg bg-white shadow-e1"
          : "grid gap-6 rounded-lg bg-white p-6 shadow-e1"}
      >
        {children}
      </div>
    </section>
  )
}

function TemplateCard({ agent }: { readonly agent: (typeof AGENTS)[number] }) {
  return (
    <div className="flex h-full flex-col items-start gap-2.5 rounded-lg bg-white p-4 shadow-e1">
      <div className="mb-1 grid h-[120px] w-full place-items-center rounded-md bg-sunken bg-[radial-gradient(rgba(10,11,13,.07)_1px,transparent_1px)] bg-size-[12px_12px] text-blue">
        <Icon name={agent.icon} size={32} />
      </div>
      <h3 className="text-body font-semibold">{agent.name}</h3>
      <p className="text-label text-g-600">{agent.say}</p>
      <Button variant="secondary" size="sm" className="mt-auto" onClick={() => toast(`Starting ${agent.name}`)}>
        Use template
      </Button>
    </div>
  )
}

function PaginationDemo() {
  const total = 12
  const [page, setPage] = useState(3)
  return (
    <div className="grid gap-5">
      <Pagination aria-label="Activity pages">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled={page === 1} onClick={() => setPage(page - 1)} />
          </PaginationItem>
          {paginationRange(page, total).map((entry, i) => (
            <PaginationItem key={entry === "ellipsis" ? `gap-${i}` : entry}>
              {entry === "ellipsis" ?
                <PaginationEllipsis /> :
                (
                  <PaginationLink
                    isActive={entry === page}
                    aria-label={`Page ${entry}`}
                    onClick={() => setPage(entry)}
                  >
                    {entry}
                  </PaginationLink>
                )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext disabled={page === total} onClick={() => setPage(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <nav aria-label="Trades pages, compact" className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-label text-g-500 tabular-nums">Showing 21–30 of 118</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Icon name="chevron-left" size={16} />Previous
          </Button>
          <Button variant="secondary" size="sm">
            Next<Icon name="chevron-right" size={16} />
          </Button>
        </div>
      </nav>
    </div>
  )
}

function SidebarDemo() {
  const [current, setCurrent] = useState("Agents")
  const main: ReadonlyArray<readonly [IconName, string, string?]> = [
    ["home", "Home"],
    ["portfolio", "Portfolio"],
    ["agents", "Agents", "3"],
    ["activity", "Activity"],
    ["approvals", "Approvals", "2"]
  ]
  return (
    <SidebarProvider className="h-[440px] min-h-0 bg-canvas">
      <Sidebar>
        <SidebarHeader>
          <span className="grid size-[22px] place-items-center rounded-full bg-blue text-white">
            <Icon name="layers" size={14} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight transition-opacity duration-base group-data-[state=collapsed]/sidebar-panel:opacity-0">
            bluechip
          </span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarMenu>
              {main.map(([icon, label, count]) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton isActive={current === label} tooltip={label} onClick={() => setCurrent(label)}>
                    <Icon name={icon} />
                    <span>{label}</span>
                  </SidebarMenuButton>
                  {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Your agents</SidebarGroupLabel>
            <SidebarMenu>
              {AGENTS.slice(0, 3).map((agent) => (
                <SidebarMenuItem key={agent.id}>
                  <SidebarMenuButton
                    tooltip={agent.name}
                    onClick={() => setCurrent(agent.name)}
                    isActive={current === agent.name}
                  >
                    <Icon name={agent.icon} />
                    <span>{agent.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenuButton
            tooltip="Settings"
            onClick={() => setCurrent("Settings")}
            isActive={current === "Settings"}
          >
            <Icon name="settings" />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex h-[50px] items-center gap-2.5 border-b border-ink/6 px-3">
          <SidebarTrigger />
          <span className="text-body-sm font-semibold">{current}</span>
        </div>
        <div className="grid content-start gap-3.5 p-[18px]">
          <div className="h-3 w-2/5 rounded-full bg-g-100" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
            {[0, 1, 2].map((n) => <div key={n} className="h-24 rounded-[12px] bg-white shadow-e1" />)}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function KitNavigation() {
  const [showAll, setShowAll] = useState(false)
  return (
    <TooltipProvider>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:px-10">
        <div className="grid gap-3">
          <h1 className="text-display-3 font-semibold">Navigation</h1>
          <p className="max-w-[64ch] text-body-lg text-g-600">
            Moving between places and views: tabs, trails, pages, menus and the app's sidebar, plus the disclosure
            patterns that tuck detail away until it's wanted.
          </p>
        </div>

        <Section
          id="tabs"
          title="Tabs"
          base="Tabs"
          purpose="Switch between views of the same thing. Arrow keys move, Home and End jump."
        >
          <Tabs defaultValue="overview">
            <TabsList aria-label="Agent">
              <TabsTab value="overview">Overview</TabsTab>
              <TabsTab value="activity">
                Activity<TabsCount>12</TabsCount>
              </TabsTab>
              <TabsTab value="limits">Limits</TabsTab>
              <TabsTab value="taxes" disabled>Taxes</TabsTab>
            </TabsList>
            <TabsPanel value="overview">
              Rebalancer checks your mix every Monday and trades only when a stock drifts more than 5% from its target.
            </TabsPanel>
            <TabsPanel value="activity">
              <ul className="grid gap-2.5">
                <li className="flex items-center gap-2.5">
                  <Badge variant="secondary">TSLA</Badge>Sold 1 share<span className="ml-auto text-label text-g-500">
                    Mon 9:02
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Badge variant="secondary">NVDA</Badge>Bought 0.6 shares
                  <span className="ml-auto text-label text-g-500">Mon 9:02</span>
                </li>
              </ul>
            </TabsPanel>
            <TabsPanel value="limits">
              <Limits rows={LIMITS.slice(0, 4)} />
            </TabsPanel>
            <TabsPanel value="taxes" />
          </Tabs>
          <Tabs defaultValue="stocks" variant="segmented">
            <TabsList aria-label="Holdings">
              <TabsTab value="stocks">Stocks</TabsTab>
              <TabsTab value="cash">Cash</TabsTab>
              <TabsTab value="agents">Agents</TabsTab>
            </TabsList>
            <TabsPanel value="stocks">
              6 stocks · <b className="tabular-nums">$9,212.40</b>
            </TabsPanel>
            <TabsPanel value="cash">
              <b className="tabular-nums">1,240.50 USDC</b> ready to use.
            </TabsPanel>
            <TabsPanel value="agents">3 agents running, 1 paused.</TabsPanel>
          </Tabs>
        </Section>

        <Section
          id="breadcrumb"
          title="Breadcrumb"
          base="Breadcrumb"
          purpose="Where you are and how you got there. Middle steps fold into a menu when space is tight."
        >
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#breadcrumb" aria-label="Home">
                  <Icon name="home" size={14} />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#breadcrumb">Agents</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#breadcrumb">Rebalancer</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Limits</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Breadcrumb aria-label="Breadcrumb, collapsed">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#breadcrumb">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Show 2 more"
                    className="grid h-6 w-[26px] cursor-pointer place-items-center rounded-[6px] text-g-500 hover:bg-g-100 hover:text-ink data-popup-open:bg-g-100"
                  >
                    <Icon name="more" size={16} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => toast("Going to Activity")}>
                      <Icon name="activity" />Activity
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast("Going to 2026")}>
                      <Icon name="calendar" />2026
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#breadcrumb">November</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Trade #2841</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </Section>

        <Section
          id="pagination"
          title="Pagination"
          base="Pagination"
          purpose="Move through long lists a page at a time. The current page is marked for screen readers too."
        >
          <PaginationDemo />
        </Section>

        <Section
          id="navigation-menu"
          title="Navigation menu"
          base="NavigationMenu"
          flush
          purpose="Site navigation with rich panels. Opens on hover or click; Esc closes and returns focus."
        >
          <div className="min-h-[420px] bg-sunken bg-[radial-gradient(rgba(10,11,13,.06)_1px,transparent_1px)] bg-size-[14px_14px]">
            <div className="flex h-[60px] items-center gap-4 border-b border-ink/6 bg-white/92 pr-4 pl-5">
              <span className="flex items-center gap-2 text-[17px] font-semibold tracking-tight max-sm:sr-only">
                <span className="grid size-[22px] place-items-center rounded-full bg-blue text-white">
                  <Icon name="layers" size={14} />
                </span>
                bluechip
              </span>
              <NavigationMenu className="mr-auto">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Agents</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="grid gap-0.5 sm:grid-cols-2">
                        <NavigationMenuLink
                          href="#navigation-menu"
                          className="flex-col justify-end gap-1.5 bg-[linear-gradient(160deg,var(--color-blue-hi),var(--color-blue)_50%,var(--color-blue-deep))] p-[18px] text-white hover:bg-[linear-gradient(160deg,var(--color-blue-hi),var(--color-blue)_50%,var(--color-blue-deep))] sm:row-span-4 sm:min-h-[230px]"
                        >
                          <Icon name="agents" size={28} />
                          <strong className="mt-2 text-body-lg font-semibold tracking-tight">
                            Agents that follow your rules
                          </strong>
                          <span className="text-label text-white/80">
                            Every agent has limits it can never break, locked with Face ID.
                          </span>
                        </NavigationMenuLink>
                        {AGENTS.slice(0, 4).map((agent) => (
                          <NavigationMenuLink key={agent.id} href="#navigation-menu">
                            <IconTile icon={agent.icon} />
                            <span className="grid gap-px">
                              <strong className="text-[13.5px] font-semibold">{agent.name}</strong>
                              <span className="text-label-sm leading-snug text-g-500">{agent.say}</span>
                            </span>
                          </NavigationMenuLink>
                        ))}
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Learn</NavigationMenuTrigger>
                    <NavigationMenuContent className="grid w-[min(340px,calc(100vw-16px))] gap-0.5">
                      {([
                        ["shield", "How limits work", "What an agent can and can't do."],
                        ["face-id", "Face ID and passkeys", "No passwords, no seed phrase."],
                        ["cash", "Cash (USDC)", "Digital dollars you can spend."],
                        ["stocks", "Tokenized stocks", "Real stock prices, onchain."]
                      ] as const).map(([icon, title, description]) => (
                        <NavigationMenuLink key={title} href="#navigation-menu">
                          <IconTile icon={icon} />
                          <span className="grid gap-px">
                            <strong className="text-[13.5px] font-semibold">{title}</strong>
                            <span className="text-label-sm text-g-500">{description}</span>
                          </span>
                        </NavigationMenuLink>
                      ))}
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink href="#navigation-menu" className={navigationMenuTriggerClassName}>
                      Pricing
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
              <Button size="sm" className="max-sm:hidden">Open app</Button>
            </div>
            <div className="grid gap-2 p-8">
              <span className="text-caption font-semibold text-blue">Built on Base</span>
              <h3 className="text-display-3 font-semibold">Agents that stay inside your limits.</h3>
              <p className="text-body-sm text-g-600">
                Hover Agents or Learn above, or Tab to a trigger and press Enter.
              </p>
            </div>
          </div>
        </Section>

        <Section
          id="menubar"
          title="Menubar"
          base="Menubar"
          purpose="A row of menus, desktop-app style. Left and Right move across menus while one is open."
        >
          <div className="flex justify-center py-10">
            <Menubar aria-label="App">
              <MenubarMenu>
                <MenubarTrigger>Account</MenubarTrigger>
                <MenubarContent className="min-w-[220px]">
                  <MenubarItem onClick={() => toast("Opening profile")}>
                    <Icon name="user" />Profile<MenubarShortcut>⇧⌘P</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem onClick={() => toast("Opening deposit")}>
                    <Icon name="cash" />Deposit cash
                  </MenubarItem>
                  <MenubarItem onClick={() => toast("Opening withdraw")}>
                    <Icon name="upload" />Withdraw
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem variant="destructive" onClick={() => toast("Logged out")}>
                    <Icon name="logout" />Log out
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger>Agents</MenubarTrigger>
                <MenubarContent className="min-w-[220px]">
                  <MenubarItem onClick={() => toast("Opening chat")}>
                    <Icon name="plus" />New agent<MenubarShortcut>⌘N</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem onClick={() => toast("All agents paused")}>
                    <Icon name="pause" />Pause all<MenubarShortcut>⇧⌘P</MenubarShortcut>
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem onClick={() => toast("Opening Rebalancer")}>
                    <Icon name="scales" />Rebalancer
                  </MenubarItem>
                  <MenubarItem onClick={() => toast("Opening Weekly buyer")}>
                    <Icon name="calendar" />Weekly buyer
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger>View</MenubarTrigger>
                <MenubarContent className="min-w-[220px]">
                  <MenubarCheckboxItem defaultChecked>Show balances</MenubarCheckboxItem>
                  <MenubarCheckboxItem defaultChecked>Show change in %</MenubarCheckboxItem>
                  <MenubarCheckboxItem>Compact rows</MenubarCheckboxItem>
                  <MenubarSeparator />
                  <MenubarItem disabled>
                    <Icon name="expand" />Full screen<MenubarShortcut>⌃⌘F</MenubarShortcut>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger>Help</MenubarTrigger>
                <MenubarContent className="min-w-[220px]">
                  <MenubarItem onClick={() => toast("Opening guide")}>
                    <Icon name="shield" />How limits work
                  </MenubarItem>
                  <MenubarItem onClick={() => toast("Showing shortcuts")}>
                    <Icon name="command" />Keyboard shortcuts<MenubarShortcut>?</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem onClick={() => toast("Opening support")}>
                    <Icon name="mail" />Contact support
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>
        </Section>

        <Section
          id="sidebar"
          title="Sidebar"
          base="Sidebar"
          flush
          purpose="The app's main navigation. Collapses to an icon rail with tooltips; ⌘B toggles it. On phones it opens as a sheet."
        >
          <SidebarDemo />
        </Section>

        <Section
          id="accordion"
          title="Accordion"
          base="Accordion"
          purpose="Stacked questions that open one at a time. Good for FAQs and long settings."
        >
          <Accordion defaultValue={["cash"]}>
            {[
              [
                "cash",
                "What can an agent do with my cash?",
                "Only what its limits allow: which stocks, how much per day and per trade, and when it must ask you. Limits are locked with Face ID and checked onchain before every trade."
              ],
              [
                "withdraw",
                "Can an agent withdraw my money?",
                "No. Agents can trade inside your account. Moving cash out always needs you and Face ID."
              ],
              [
                "stopped",
                "What happens when a limit stops a trade?",
                "The trade doesn't happen. You'll see “Your limit stopped this trade” in Activity, with the limit that stopped it."
              ],
              [
                "remove",
                "How do I remove an agent?",
                "Open the agent and choose Remove agent. It stops right away; your stocks and cash stay put."
              ]
            ].map(([value, question, answer]) => (
              <AccordionItem key={value} value={value} disabled={value === "remove"}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent>{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>

        <Section
          id="collapsible"
          title="Collapsible"
          base="Collapsible"
          purpose="Shows or hides one block of extra detail."
        >
          <Collapsible
            open={showAll}
            onOpenChange={setShowAll}
            className="grid w-full max-w-[420px] gap-1 justify-self-center"
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="text-body font-semibold">Weekly buyer has 8 limits</strong>
              <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                <Icon name={showAll ? "collapse" : "expand"} size={16} />
                {showAll ? "Show less" : "Show all"}
              </CollapsibleTrigger>
            </div>
            <Limits rows={LIMITS.slice(0, 3)} />
            <CollapsibleContent>
              <Limits rows={LIMITS.slice(3)} />
            </CollapsibleContent>
          </Collapsible>
        </Section>

        <Section
          id="carousel"
          title="Carousel"
          base="Carousel (Embla)"
          purpose="A row of cards you page through with arrows, dots, the arrow keys, or by dragging and swiping."
        >
          <Carousel aria-label="Agent templates">
            <CarouselContent>
              {AGENTS.map((agent, i) => (
                <CarouselItem key={agent.id} aria-label={`${i + 1} of ${AGENTS.length}`}>
                  <TemplateCard agent={agent} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselControls />
          </Carousel>
          <div className="grid gap-2">
            <span className="text-caption font-semibold text-g-400">Looping, one at a time</span>
            <Carousel aria-label="Agent templates, looping" opts={{ loop: true }} className="max-w-[360px]">
              <CarouselContent>
                {AGENTS.map((agent, i) => (
                  <CarouselItem
                    key={agent.id}
                    aria-label={`${i + 1} of ${AGENTS.length}`}
                    className="min-[600px]:basis-full min-[1100px]:basis-full"
                  >
                    <TemplateCard agent={agent} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselControls />
            </Carousel>
          </div>
        </Section>

        <Section
          id="resizable"
          title="Resizable"
          base="Resizable (react-resizable-panels)"
          flush
          purpose="Panels you can resize by dragging the handle, or with the arrow keys when it's focused."
        >
          <div className="h-[260px]">
            <ResizablePanelGroup>
              <ResizablePanel id="agents" defaultSize="34%" minSize="20%" maxSize="80%">
                <div className="grid content-start gap-2.5 p-4 text-[13.5px]">
                  <span className="text-caption font-semibold text-g-400">Agents</span>
                  {AGENTS.slice(0, 3).map((agent) => (
                    <span key={agent.id} className="flex items-center gap-2">
                      <Icon name={agent.icon} size={16} className="text-blue" />
                      {agent.name}
                    </span>
                  ))}
                </div>
              </ResizablePanel>
              <ResizableHandle aria-label="Resize agents panel" />
              <ResizablePanel id="workspace" minSize="20%">
                <ResizablePanelGroup orientation="vertical">
                  <ResizablePanel id="chat" defaultSize="55%" minSize="20%" maxSize="80%">
                    <div className="grid content-start gap-2.5 p-4 text-[13.5px]">
                      <span className="text-caption font-semibold text-g-400">Chat</span>
                      <p className="text-label text-g-600">“Create an agent that can only rebalance my portfolio.”</p>
                    </div>
                  </ResizablePanel>
                  <ResizableHandle aria-label="Resize chat panel" />
                  <ResizablePanel id="limits" minSize="20%">
                    <div className="grid content-start gap-2.5 p-4 text-[13.5px]">
                      <span className="text-caption font-semibold text-g-400">Limits preview</span>
                      <p className="text-label text-g-600">Rebalance only · Max 25% in one stock · Cash reserve $200</p>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          <div className="h-[140px] border-t border-g-100">
            <ResizablePanelGroup>
              <ResizablePanel id="sidebar" defaultSize="28%" minSize="18%" collapsible collapsedSize="0%">
                <div className="grid content-start gap-1 p-4 text-[13.5px]">
                  <span className="text-caption font-semibold text-g-400">Collapsible · no grip</span>
                  <p className="text-label text-g-600">
                    Drag past the edge, or press Enter on the line, to fold it away.
                  </p>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle={false} aria-label="Resize activity panel" />
              <ResizablePanel id="activity">
                <div className="grid content-start gap-1 p-4 text-[13.5px]">
                  <span className="text-caption font-semibold text-g-400">Activity</span>
                  <p className="text-label text-g-600">Rebalancer bought $40.00 of Apple · 2 minutes ago</p>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </Section>
      </div>
      <Toaster />
    </TooltipProvider>
  )
}
