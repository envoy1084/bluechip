import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { useAtomMount } from "@effect/atom-react/Hooks"
import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router"
import { liveEventAtom } from "../api/events.ts"
import { SignedIn } from "../auth/SignedIn.tsx"
import { ConnectionBanner } from "../shell/ConnectionBanner.tsx"

// Signed-in pages render in the browser: they need the session cookie and the live stream.
export const Route = createFileRoute("/_app")({ ssr: false, component: AppLayout })

const navLinkClass =
  "rounded-sm px-2.5 py-1.5 text-body-sm font-medium text-g-600 hover:bg-g-100 hover:text-ink data-[status=active]:text-ink"

function AppLayout() {
  return (
    <SignedIn>
      {(me) =>
        me.user.eligibility === "unknown" ?
          <Navigate to="/welcome/eligibility" /> :
          (
            <div className="min-h-dvh bg-canvas">
              <LiveUpdates />
              <header className="sticky top-0 z-10 border-b border-ink/5 bg-canvas/85 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
                  <Link to="/home" className="text-title-3 font-semibold tracking-tight">bluechip</Link>
                  <nav className="flex gap-1" aria-label="Main">
                    <Link to="/home" className={navLinkClass}>Home</Link>
                    <Link to="/settings" className={navLinkClass}>Settings</Link>
                  </nav>
                  <AddressChip address={me.account.address} className="ml-auto" />
                </div>
              </header>
              <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
                <ConnectionBanner />
                <Outlet />
              </div>
            </div>
          )}
    </SignedIn>
  )
}

/** Keeps the live event stream open while signed-in pages are shown. */
function LiveUpdates() {
  useAtomMount(liveEventAtom)
  return null
}
