import { StartClient } from "@tanstack/react-start/client"
import { startTransition, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"

// Preview mode (`?preview`, development only): the app runs against made-up data served in the browser, with a panel
// to put every screen in every state. Vite drops this branch, and the preview with it, from production builds.
if (import.meta.env.DEV) {
  const { previewScenario } = await import("./preview/activation.ts")
  const scenario = previewScenario()
  if (scenario !== null) await (await import("./preview/install.ts")).install(scenario)
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  )
})
