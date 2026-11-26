import { Logo } from "@bluechip/ui/bluechip/logo"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { SweepProvider } from "@bluechip/ui/motion/sweep"
import { createRootRoute, Link, Outlet } from "@tanstack/react-router"

export const Route = createRootRoute({ component: KitLayout })

const SECTIONS: ReadonlyArray<{ readonly to: string; readonly label: string; readonly icon: IconName }> = [
  { to: "/", label: "Overview", icon: "home" },
  { to: "/foundations", label: "Foundations", icon: "palette" },
  { to: "/forms", label: "Inputs & forms", icon: "edit" },
  { to: "/display", label: "Data display", icon: "grid" },
  { to: "/overlays", label: "Overlays", icon: "layers" },
  { to: "/navigation", label: "Navigation", icon: "menu" },
  { to: "/bluechip", label: "Money & activity", icon: "wallet" },
  { to: "/trading", label: "Portfolio & trading", icon: "pie" },
  { to: "/agents", label: "Agents & chat", icon: "agent" },
  { to: "/cards", label: "Chat cards", icon: "chat" },
  { to: "/agent-builder", label: "Agent builder", icon: "shield" },
  { to: "/end-states", label: "End states", icon: "check-circle" },
  { to: "/motion", label: "Motion", icon: "play" },
  { to: "/illustrations", label: "Illustrations", icon: "image" }
]

// A private showcase of @bluechip/ui, mirroring the brand kit artifact section by section.
function KitLayout() {
  return (
    <div className="grid min-h-dvh md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r border-ink/5 bg-g-50 px-3 py-5 md:flex">
        <span className="flex items-center justify-between px-2">
          <Logo />
          <span className="rounded-full bg-g-100 px-[7px] py-0.5 text-[11.5px] font-semibold text-g-500">Kit</span>
        </span>
        <nav className="grid gap-px" aria-label="Kit sections">
          {SECTIONS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-body-sm font-medium text-g-600 hover:bg-g-100 hover:text-ink data-[status=active]:bg-white data-[status=active]:text-ink data-[status=active]:shadow-e1"
            >
              <Icon name={s.icon} size={16} />
              {s.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0">
        <SweepProvider>
          <Outlet />
        </SweepProvider>
      </main>
    </div>
  )
}
