import { StartClient } from "@tanstack/react-start/client"
import { startTransition, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"

// Preview mode (`?preview`, development only): the app runs against made-up data served in the browser, with a panel
// to put every screen in every state. The software passkey (`?softPasskey`, development only) answers the real
// server's passkey prompts with real keys kept in the browser; preview mode fakes its own. Vite drops this branch,
// and both with it, from production builds.
if (import.meta.env.DEV) {
  const { previewScenario } = await import("./preview/activation.ts")
  const { softPasskeyOn } = await import("./preview/softPasskey/activation.ts")
  const scenario = previewScenario()
  const softPasskey = softPasskeyOn()
  if (scenario !== null) await (await import("./preview/install.ts")).install(scenario)
  else if (softPasskey) (await import("./preview/softPasskey/install.ts")).install()
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  )
})
