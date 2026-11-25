import { Button } from "@bluechip/ui/components/button"
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
import { toast } from "@bluechip/ui/components/toast"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { AGENTS } from "./data.ts"
import { IconTile, Section } from "./layout.tsx"

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

export function NavigationMenuSection() {
  return (
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
  )
}

export function MenubarSection() {
  return (
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
  )
}

export function SidebarSection() {
  return (
    <Section
      id="sidebar"
      title="Sidebar"
      base="Sidebar"
      flush
      purpose="The app's main navigation. Collapses to an icon rail with tooltips; ⌘B toggles it. On phones it opens as a sheet."
    >
      <SidebarDemo />
    </Section>
  )
}
