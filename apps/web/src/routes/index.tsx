import { buttonVariants } from "@bluechip/ui/components/button"
import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Landing })

// The landing page arrives with phase 015; until then it is the way in. Links, not buttons, so they work before the
// page hydrates.
function Landing() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="grid justify-items-center gap-6 text-center">
        <h1 className="text-display-2 font-semibold tracking-tight">bluechip</h1>
        <p className="max-w-[40ch] text-body-lg text-g-600">You and your agents, trading stocks on Base.</p>
        <div className="flex gap-3">
          <Link to="/welcome" className={buttonVariants({ size: "lg" })}>Create account</Link>
          <Link to="/signin" className={buttonVariants({ size: "lg", variant: "secondary" })}>Sign in</Link>
        </div>
      </div>
    </main>
  )
}
