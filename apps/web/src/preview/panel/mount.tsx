// The panel renders in a root of its own beside the app, so it never takes part in the app's tree or state.
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Panel } from "./Panel.tsx"

export const mountPanel = () => {
  const start = () => {
    const host = document.createElement("div")
    host.id = "bluechip-preview-panel"
    document.body.append(host)
    createRoot(host).render(
      <StrictMode>
        <Panel />
      </StrictMode>
    )
  }
  // After hydration: the app owns the document's markup until then.
  window.addEventListener("load", () => setTimeout(start, 0), { once: true })
}
