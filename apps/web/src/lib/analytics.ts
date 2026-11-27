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

/** Loads PostHog and starts capturing (pageviews, replays, the typed events). */
export const startAnalytics = async (setup: AnalyticsSetup): Promise<void> => {
  const waiting: Array<(posthog: PostHog) => void> = []
  state = { _tag: "Loading", waiting }
  const { default: posthog } = await import("posthog-js")
  posthog.init(setup.projectKey, posthogConfig(setup, { origin: location.origin }))
  posthog.register(commonProperties(setup))
  state = { _tag: "On", posthog }
  for (const use of waiting) use(posthog)
}
