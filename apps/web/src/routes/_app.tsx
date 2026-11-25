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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from "@bluechip/ui/components/sidebar"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { useAtomMount } from "@effect/atom-react/Hooks"
import { createFileRoute, Link, Navigate, Outlet, useMatchRoute } from "@tanstack/react-router"
import { liveEventAtom } from "../api/events.ts"
import { SignedIn } from "../auth/SignedIn.tsx"
import { CashDialogs } from "../funding/CashDialogs.tsx"

// Signed-in pages render in the browser: they need the session cookie and the live stream.
export const Route = createFileRoute("/_app")({ ssr: false, component: AppLayout })

// Agents and Approvals join as their phases land.
const NAV: ReadonlyArray<
  {
    readonly to: "/home" | "/portfolio" | "/stocks" | "/activity" | "/settings"
    readonly label: string
    readonly icon: IconName
  }
> = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { to: "/stocks", label: "Stocks", icon: "stocks" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/settings", label: "Settings", icon: "settings" }
]

function AppLayout() {
  const matchRoute = useMatchRoute()
  return (
    <SignedIn>
      {(me) =>
        me.user.eligibility !== "outsideUs" ?
          <Navigate to="/welcome/eligibility" /> :
          (
            <SidebarProvider className="bg-canvas">
              <LiveUpdates />
              <CashDialogs />
              <Sidebar collapsible="none" className="bg-g-50">
                <SidebarHeader className="px-2 pt-0.5 pb-1">
                  <Logo />
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarMenu>
                      {NAV.map((item) => (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            isActive={matchRoute({ to: item.to }) !== false}
                            render={<Link to={item.to} />}
                          >
                            <Icon name={item.icon} />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                  <div className="flex items-center gap-2.5 border-t border-ink/6 px-1.5 pt-3">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,#eef1ff,#dfe5ff)] text-[13px] font-semibold text-blue shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(42,91,255,.14)]">
                      {(me.user.displayName ?? "Y").charAt(0).toUpperCase()}
                    </span>
                    <span className="grid min-w-0">
                      <b className="truncate text-[13px] font-semibold">{me.user.displayName ?? "You"}</b>
                      <span className="font-mono text-[11.5px] text-g-500">{shortAddress(me.account.address)}</span>
                    </span>
                  </div>
                </SidebarFooter>
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
