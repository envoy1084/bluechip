import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Landing })

// The landing page arrives with phase 015; the component kit lives in apps/uikit.
function Landing() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <h1 className="text-title-1 font-semibold tracking-tight">bluechip</h1>
    </main>
  )
}
