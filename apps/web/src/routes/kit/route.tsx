import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { createFileRoute, Link, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/kit")({ component: KitLayout })

const SECTIONS: ReadonlyArray<{ readonly to: string; readonly label: string; readonly icon: IconName }> = [
  { to: "/kit", label: "Overview", icon: "home" },
  { to: "/kit/foundations", label: "Foundations", icon: "palette" },
  { to: "/kit/forms", label: "Inputs & forms", icon: "edit" },
  { to: "/kit/display", label: "Data display", icon: "grid" },
  { to: "/kit/overlays", label: "Overlays", icon: "layers" },
  { to: "/kit/navigation", label: "Navigation", icon: "menu" },
  { to: "/kit/bluechip", label: "bluechip components", icon: "agent" },
  { to: "/kit/motion", label: "Motion", icon: "play" },
  { to: "/kit/illustrations", label: "Illustrations", icon: "image" }
]

// Dev-only showcase of @bluechip/ui, mirroring the brand kit artifact section by section.
function KitLayout() {
  return (
    <div className="grid min-h-dvh md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r border-ink/5 bg-g-50 px-3 py-5 md:flex">
        <span className="px-2 text-title-3 font-semibold">bluechip kit</span>
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
        <Outlet />
      </main>
    </div>
  )
}
