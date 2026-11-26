import { shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { Logo } from "@bluechip/ui/bluechip/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail
} from "@bluechip/ui/components/sidebar"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { useAtomMount } from "@effect/atom-react/Hooks"
import { Link, Navigate, Outlet, useMatchRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { SignedIn } from "../../../components/SignedIn.tsx"
import { liveEventAtom } from "../../../lib/api/events.ts"

const NAV: ReadonlyArray<
  {
    readonly to:
      | "/home"
      | "/chat/{-$conversationId}"
      | "/portfolio"
      | "/stocks"
      | "/agents"
      | "/activity"
      | "/approvals"
      | "/settings"
    readonly label: string
    readonly icon: IconName
  }
> = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/chat/{-$conversationId}", label: "Chat", icon: "chat" },
  { to: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { to: "/stocks", label: "Stocks", icon: "stocks" },
  { to: "/agents", label: "Agents", icon: "agents" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/approvals", label: "Approvals", icon: "approvals" },
  { to: "/settings", label: "Settings", icon: "settings" }
]

/**
 * The frame of every signed-in page: the sidebar's navigation, then the page. What other features show in it comes
 * from the route: the approvals badge count, the sidebar's agents and kill switch, and the cash dialogs.
 */
export function AppLayout(
  { approvals, agents, pauseAll, dialogs }: Readonly<{
    approvals: number
    agents: ReactNode
    pauseAll: ReactNode
    dialogs: ReactNode
  }>
) {
  const matchRoute = useMatchRoute()
  return (
    <SignedIn>
      {(me) =>
        me.user.eligibility !== "outsideUs" ?
          <Navigate to="/welcome/eligibility" /> :
          (
            <SidebarProvider className="bg-canvas" storageKey="bluechip:sidebar">
              <LiveUpdates />
              {dialogs}
              <Sidebar collapsible="icon" className="bg-g-50">
                <SidebarHeader className="px-2 pt-0.5 pb-1 group-data-[collapsible=icon]/sidebar-panel:px-[7px] [&_[data-slot=logo]>span]:transition-opacity group-data-[collapsible=icon]/sidebar-panel:[&_[data-slot=logo]>span]:opacity-0">
                  <Logo />
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarMenu>
                      {NAV.map((item) => (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            isActive={matchRoute({ to: item.to, fuzzy: item.label === "Chat" }) !== false}
                            tooltip={item.label}
                            render={<Link to={item.to} params={{ conversationId: undefined }} />}
                          >
                            <Icon name={item.icon} />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                          {item.to === "/approvals" && approvals > 0 ?
                            <SidebarMenuBadge aria-label={`${approvals} waiting`}>{approvals}</SidebarMenuBadge> :
                            null}
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroup>
                  {agents}
                </SidebarContent>
                <SidebarFooter>
                  {pauseAll}
                  <div className="flex items-center gap-2.5 border-t border-ink/6 px-1.5 pt-3">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-blue-50 text-[13px] font-semibold text-blue ring-1 ring-blue/15">
                      {(me.user.displayName ?? "Y").charAt(0).toUpperCase()}
                    </span>
                    <span className="grid min-w-0 transition-opacity duration-base group-data-[collapsible=icon]/sidebar-panel:opacity-0">
                      <b className="truncate text-[13px] font-semibold">{me.user.displayName ?? "You"}</b>
                      <span className="font-mono text-[11.5px] text-g-500">{shortAddress(me.account.address)}</span>
                    </span>
                  </div>
                </SidebarFooter>
                <SidebarRail />
              </Sidebar>
              <SidebarInset>
                <Outlet />
              </SidebarInset>
            </SidebarProvider>
          )}
    </SignedIn>
  )
}

/** Keeps the live event stream open while signed-in pages are shown. */
function LiveUpdates() {
  useAtomMount(liveEventAtom)
  return null
}
