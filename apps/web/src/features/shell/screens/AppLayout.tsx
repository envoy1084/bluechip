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
import { FrameActionsProvider } from "../../../components/layout/FrameActions.tsx"
import { PaperBadge, PaperBanner } from "../../../components/layout/PaperBadge.tsx"
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
      | "/automations"
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
  { to: "/automations", label: "Automations", icon: "zap" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/approvals", label: "Approvals", icon: "approvals" },
  { to: "/settings", label: "Settings", icon: "settings" }
]

/**
 * The frame of every signed-in page: the sidebar's navigation, then the page. What other features show in it comes
 * from the route: the approvals badge count, the sidebar's agents and kill switch, the cash dialogs, and what every
 * page's top bar ends with (approvals with their sheet, and the notifications panel).
 */
export function AppLayout(
  { approvals, agents, pauseAll, dialogs, topBar }: Readonly<{
    approvals: number
    agents: ReactNode
    pauseAll: ReactNode
    dialogs: ReactNode
    topBar: ReactNode
  }>
) {
  const matchRoute = useMatchRoute()
  const onChat = matchRoute({ to: "/chat/{-$conversationId}", fuzzy: true }) !== false
  return (
    <SignedIn>
      {(me) =>
        me.user.eligibility !== "outsideUs" ?
          <Navigate to="/welcome/eligibility" /> :
          (
            <SidebarProvider
              className="bg-canvas"
              // The chat page has its own chats sidebar, so the app's folds there by default; each keeps what you set.
              storageKey={onChat ? "bluechip:sidebar:chat" : "bluechip:sidebar"}
              defaultOpen={!onChat}
            >
              <LiveUpdates />
              {dialogs}
              <Sidebar collapsible="icon" className="bg-g-50">
                <SidebarHeader className="px-2 pt-0.5 pb-1 group-data-[collapsible=icon]/sidebar-panel:px-[7px] [&_[data-slot=logo]>span]:transition-opacity group-data-[collapsible=icon]/sidebar-panel:[&_[data-slot=logo]>span]:opacity-0">
                  <Link to="/home" aria-label="bluechip, home" className="rounded-sm outline-offset-2">
                    <Logo />
                  </Link>
                  <PaperBadge className="ml-2 self-start group-data-[collapsible=icon]/sidebar-panel:hidden" />
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarMenu>
                      {NAV.map((item) => (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            // An agent's pages and New agent light their own rows under "Your agents", not Agents.
                            isActive={matchRoute({ to: item.to, fuzzy: item.to !== "/agents" }) !== false ||
                              (item.to === "/settings" && matchRoute({ to: "/memory" }) !== false)}
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
                </SidebarFooter>
                <SidebarRail />
              </Sidebar>
              <SidebarInset>
                <PaperBanner />
                <FrameActionsProvider value={topBar}>
                  <Outlet />
                </FrameActionsProvider>
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
