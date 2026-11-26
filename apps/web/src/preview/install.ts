// Turns preview mode on for this tab, before the app starts: the mock API answers `/api` in the browser, Face ID
// answers with made-up passkeys, saved panel actions play again, and the god mode panel mounts beside the app.
import { areaOf } from "./network.ts"
import { ACTIONS } from "./panel/actions.ts"
import { mountPanel } from "./panel/mount.tsx"
import { fakePasskeys } from "./passkeys.ts"
import { mockApi } from "./server/MockApi.ts"
import { createPreviewStore } from "./store.ts"
import type { ScenarioId } from "./world/cast.ts"

const SLOW_MS = 2_500

export const install = async (scenario: ScenarioId) => {
  const store = createPreviewStore(scenario, ACTIONS)
  const api = mockApi(store)
  const realFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    if (!path.startsWith("/api/") && !path.startsWith("/auth/")) return realFetch(input, init)

    const area = areaOf(path)
    const mode = area === undefined ? "normal" : store.settings.network[area] ?? "normal"
    if (mode === "loading") return new Promise<Response>(() => {})
    if (mode === "error") throw new TypeError("Failed to fetch (preview: this area is set to fail)")
    if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, SLOW_MS))
    return api.handler(request)
  }

  fakePasskeys(() => store.settings.faceId)
  mountPanel()
}
