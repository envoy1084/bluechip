// The panel renders in a root of its own beside the app, so it never takes part in the app's tree or state.
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Panel } from "./Panel.tsx"

// Long enough for the app to hydrate the document first: until then React owns `<body>`'s markup.
const AFTER_HYDRATION_MS = 600

export const mountPanel = () => {
  const start = () => {
    if (document.getElementById("bluechip-preview-panel") !== null) return
    const host = document.createElement("div")
    host.id = "bluechip-preview-panel"
    document.body.append(host)
    createRoot(host).render(
      <StrictMode>
        <Panel />
      </StrictMode>
    )
  }
  // Preview mode installs while the page loads, so the load event may already be over.
  if (document.readyState === "complete") setTimeout(start, AFTER_HYDRATION_MS)
  else window.addEventListener("load", () => setTimeout(start, AFTER_HYDRATION_MS), { once: true })
}
