// Product analytics (PostHog), loaded only when `analyticsSetup` says this page reports. Until then, and always when
// it doesn't, every call here does nothing; events sent while PostHog loads wait for it.
import { toCapture } from "@bluechip/domain/analytics/Events"
import type { CommonProperties } from "@bluechip/domain/analytics/Properties"
import type { WebEvent } from "@bluechip/domain/analytics/WebEvents"
import type { PostHog } from "posthog-js"
import { type AnalyticsSetup, posthogConfig } from "./analyticsSetup.ts"

type State =
  | { readonly _tag: "Off" }
  | { readonly _tag: "Loading"; readonly waiting: Array<(posthog: PostHog) => void> }
  | { readonly _tag: "On"; readonly posthog: PostHog }

let state: State = { _tag: "Off" }

const withPostHog = (use: (posthog: PostHog) => void) => {
  if (state._tag === "On") use(state.posthog)
  else if (state._tag === "Loading") state.waiting.push(use)
}

/** The properties every web event carries (PostHog's super properties). */
export const commonProperties = (setup: AnalyticsSetup): CommonProperties => ({
  network: setup.network,
  environment: setup.environment,
  app_version: setup.appVersion
})

let previousPathname: string | undefined

/** The page someone was on before this one, for events that say where they came from. */
export const previousPage = (): string | undefined => previousPathname

/** Remembers the page someone is leaving, as the router starts the move. */
export const notePageLeft = (pathname: string): void => {
  previousPathname = pathname
}

/** Sends one of the catalogue's web events. */
export const track = (event: WebEvent): void => {
  const { event: name, properties } = toCapture(event)
  withPostHog((posthog) => posthog.capture(name, properties))
}

/** Joins this browser's events, from before too, to the person: the user id, and nothing else about them. */
export const identify = (userId: string): void => withPostHog((posthog) => posthog.identify(userId))

/** Forgets the person after signing out, so the next one on this browser starts anonymous. */
export const resetAnalytics = (): void => withPostHog((posthog) => posthog.reset())

/** The replay's session, sent with API calls (`x-bluechip-replay-session`) so the server's events and traces link to it. */
export const replaySessionId = (): string | null => {
  if (state._tag !== "On" || state.posthog.has_opted_out_capturing()) return null
  return state.posthog.get_session_id()
}

// The opt-out lives in this browser (PostHog keeps its own copy too), read before PostHog loads.
const OPT_OUT_KEY = "bluechip.analytics.optOut"
const optOutListeners = new Set<() => void>()

/** Whether you turned product analytics off in Settings, on this browser. */
export const analyticsOptedOut = (): boolean => {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1"
  } catch {
    return false
  }
}

/** Calls `listener` when the opt-out changes; returns the unsubscribe. */
export const subscribeAnalyticsOptOut = (listener: () => void): () => void => {
  optOutListeners.add(listener)
  return () => optOutListeners.delete(listener)
}

/** Turns product analytics off (or back on) for this browser: no events, no replays. */
export const setAnalyticsOptOut = (optedOut: boolean): void => {
  try {
    if (optedOut) localStorage.setItem(OPT_OUT_KEY, "1")
    else localStorage.removeItem(OPT_OUT_KEY)
  } catch {
    // Storage is off: PostHog's own opt-out below still holds for this page.
  }
  // The change itself is the last event before opting out, and the first after opting back in.
  const changed: WebEvent = { _tag: "settings_changed", setting: "analytics_opt_out" }
  if (optedOut) {
    track(changed)
    withPostHog((posthog) => posthog.opt_out_capturing())
  } else {
    withPostHog((posthog) => posthog.opt_in_capturing())
    track(changed)
  }
  for (const listener of optOutListeners) listener()
}

/** Loads PostHog and starts capturing (pageviews, replays, the typed events). */
export const startAnalytics = async (setup: AnalyticsSetup): Promise<void> => {
  const waiting: Array<(posthog: PostHog) => void> = []
  state = { _tag: "Loading", waiting }
  const { default: posthog } = await import("posthog-js")
  const optedOut = analyticsOptedOut()
  posthog.init(setup.projectKey, posthogConfig(setup, { origin: location.origin, optedOut }))
  posthog.register(commonProperties(setup))
  if (optedOut) posthog.opt_out_capturing()
  state = { _tag: "On", posthog }
  for (const use of waiting) use(posthog)
}
