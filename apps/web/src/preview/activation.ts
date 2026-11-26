// Whether this browser tab runs in preview mode, and with which made-up account. `?preview` (or `?preview=heavy`) turns
// it on for the tab, `?preview=off` turns it off; the choice is kept in the tab's session storage across reloads.
import { type ScenarioId, SCENARIOS } from "./world/cast.ts"

const KEY = "bluechip:preview"

/** The scenario this tab previews, or `null` when it talks to the real server. */
export const previewScenario = (): ScenarioId | null => {
  const asked = new URLSearchParams(window.location.search).get("preview")
  if (asked === "off") {
    sessionStorage.removeItem(KEY)
    return null
  }
  if (asked !== null) {
    const scenario = SCENARIOS.some((known) => known.id === asked) ? asked as ScenarioId : "typical"
    sessionStorage.setItem(KEY, scenario)
    return scenario
  }
  const kept = sessionStorage.getItem(KEY)
  return SCENARIOS.some((known) => known.id === kept) ? kept as ScenarioId : null
}

/** Switches the tab to another scenario (or off) and starts it fresh. */
export const switchPreview = (scenario: ScenarioId | null) => {
  if (scenario === null) sessionStorage.removeItem(KEY)
  else sessionStorage.setItem(KEY, scenario)
  sessionStorage.removeItem(`${KEY}:actions`)
  const url = new URL(window.location.href)
  url.searchParams.delete("preview")
  window.location.assign(url.toString())
}
