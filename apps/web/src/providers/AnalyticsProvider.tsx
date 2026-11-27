import { useRouter } from "@tanstack/react-router"
import { type ReactNode, useEffect } from "react"
import { notePageLeft, startAnalytics } from "../lib/analytics.ts"
import { analyticsSetup } from "../lib/analyticsSetup.ts"
import { landingOnly } from "../lib/appUrl.ts"
import { network } from "../lib/network.ts"
import { site } from "../lib/seo/currentSite.ts"
import { sendsToPaper } from "../lib/seo/site.ts"
import { recordPage, startTelemetry } from "../lib/telemetry.ts"

/**
 * Starts product analytics and the browser's telemetry, from `client.tsx` before the app hydrates (never on the
 * server's render), when this build reports: paper or production with PostHog's key, never in development or with
 * `?preview`.
 */
export const startObservability = async (): Promise<void> => {
  const setup = analyticsSetup({
    dev: import.meta.env.DEV,
    preview: new URLSearchParams(location.search).has("preview"),
    network,
    projectKey: import.meta.env["VITE_POSTHOG_PROJECT_API_KEY"],
    posthogHost: import.meta.env["VITE_POSTHOG_HOST"],
    deploymentEnvironment: import.meta.env["VITE_DEPLOYMENT_ENVIRONMENT"],
    appVersion: import.meta.env["VITE_APP_VERSION"] ?? "0.0.0",
    landingOnly,
    sendsToPaper: sendsToPaper(site)
  })
  if (setup === null) return

  // The app renders whatever telemetry does: a failure to start it goes on as an uncaught error (PostHog's error
  // tracking and the browser's console see it), not in the way of hydrating.
  if (setup.telemetry) {
    await startTelemetry(setup).catch((error: unknown) =>
      queueMicrotask(() => {
        throw error
      })
    )
  }
  void startAnalytics(setup)
}

let loadRecorded = false

/** The page's first load and every move between routes, as spans (PostHog sees pageviews itself). */
export function AnalyticsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter()

  useEffect(() => {
    if (!loadRecorded) {
      loadRecorded = true
      const [timing] = performance.getEntriesByType("navigation") as Array<PerformanceNavigationTiming>
      recordPage(
        "load",
        location.pathname,
        performance.timeOrigin,
        timing === undefined ? {} : {
          "page.ttfb_ms": Math.round(timing.responseStart),
          "page.dom_content_loaded_ms": Math.round(timing.domContentLoadedEventEnd)
        }
      )
    }

    let started = Date.now()
    const stopBefore = router.subscribe("onBeforeNavigate", (event) => {
      started = Date.now()
      if (event.fromLocation !== undefined && event.pathChanged) notePageLeft(event.fromLocation.pathname)
    })
    const stopResolved = router.subscribe("onResolved", (event) => {
      if (event.fromLocation === undefined || !event.pathChanged) return
      recordPage("navigation", event.toLocation.pathname, started)
    })
    return () => {
      stopBefore()
      stopResolved()
    }
  }, [router])

  return children
}
