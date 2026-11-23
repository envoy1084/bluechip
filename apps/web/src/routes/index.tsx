import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Landing })

// The landing page is built in phase 005; until then this links to the kit.
function Landing() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="grid gap-4 text-center">
        <h1 className="text-title-1 font-semibold tracking-tight">bluechip</h1>
        <Link to="/kit" className="text-blue underline">Open the component kit</Link>
      </div>
    </main>
  )
}
