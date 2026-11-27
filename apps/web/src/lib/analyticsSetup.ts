import type { Network } from "@bluechip/chain/Network"
import type { Environment } from "@bluechip/domain/analytics/Properties"
import type { CaptureResult, PostHogConfig } from "posthog-js"
import { templatePath, templateUrl } from "./pagePath.ts"

/** Where product analytics and the browser's telemetry report: paper money or production. */
export interface AnalyticsSetup {
  readonly environment: typeof Environment.Type
  readonly network: "sepolia" | "base"
  readonly projectKey: string
  /** Where posthog-js sends: the PostHog reverse proxy on our own domain (`VITE_POSTHOG_HOST`). */
  readonly posthogHost: string
  readonly appVersion: string
}

/** What decides whether this page reports anything, read once in the browser. */
export interface AnalyticsSwitches {
  /** Vite's development server: never reports. */
  readonly dev: boolean
  /** The page was opened with `?preview` (made-up data): never reports. */
  readonly preview: boolean
  readonly network: Network
  readonly projectKey: string | undefined
  /** `VITE_POSTHOG_HOST`. */
  readonly posthogHost: string | undefined
  /** `VITE_DEPLOYMENT_ENVIRONMENT`, when the build names its deployment instead of deriving it from the network. */
  readonly deploymentEnvironment: string | undefined
  readonly appVersion: string
}

/**
 * Whether and where this page reports: only a paper or production build (never the development server, never
 * preview mode, never the local chain) with PostHog's project key and host. `null` turns analytics and telemetry off.
 */
export const analyticsSetup = (switches: AnalyticsSwitches): AnalyticsSetup | null => {
  if (switches.dev || switches.preview) return null
  if (switches.network === "local") return null
  if (switches.projectKey === undefined || switches.projectKey.trim() === "") return null
  if (switches.posthogHost === undefined || switches.posthogHost.trim() === "") return null

  const derived = switches.network === "sepolia" ? "paper" : "production"
  const environment = switches.deploymentEnvironment === "paper" || switches.deploymentEnvironment === "production"
    ? switches.deploymentEnvironment
    : derived
  return {
    environment,
    network: switches.network,
    projectKey: switches.projectKey,
    posthogHost: switches.posthogHost.replace(/\/+$/, ""),
    appVersion: switches.appVersion
  }
}

const URL_PROPERTIES = ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer", "$prev_pageview_url"]
const PATH_PROPERTIES = ["$pathname", "$initial_pathname", "$prev_pageview_pathname"]

const templateProperties = (properties: Record<string, unknown> | undefined, origin: string) => {
  if (properties === undefined) return undefined
  const templated: Record<string, unknown> = { ...properties }
  for (const name of URL_PROPERTIES) {
    const value = templated[name]
    // Another site's address (a referrer) is kept; it carries none of our ids.
    if (typeof value === "string") templated[name] = templateUrl(value, origin) ?? value
  }
  for (const name of PATH_PROPERTIES) {
    const value = templated[name]
    if (typeof value === "string") templated[name] = templatePath(value)
  }
  return templated
}

/** An event as PostHog sends it, with this site's addresses templated by route (`before_send`). */
export const templateCapture = (capture: CaptureResult, origin: string): CaptureResult => {
  const $set = templateProperties(capture.$set, origin)
  const $set_once = templateProperties(capture.$set_once, origin)
  return {
    ...capture,
    properties: templateProperties(capture.properties, origin) ?? {},
    ...($set === undefined ? {} : { $set }),
    ...($set_once === undefined ? {} : { $set_once })
  }
}

/**
 * PostHog's settings for this page. Events go to PostHog's reverse proxy on our own domain (`VITE_POSTHOG_HOST`, so
 * ad blockers keep the funnels whole); only identified people get a profile; events are the typed catalogue's (no autocapture), plus
 * pageviews by route, page leaves, exceptions and web vitals. Replays never record what anyone types, nor the network
 * bodies (amounts), and on production they record no text at all (on paper, only what is marked `data-ph-mask`).
 */
export const posthogConfig = (
  setup: AnalyticsSetup,
  options: { readonly origin: string }
): Partial<PostHogConfig> => ({
  api_host: setup.posthogHost,
  ui_host: "https://us.posthog.com",
  defaults: "2026-08-30",
  person_profiles: "identified_only",
  autocapture: false,
  capture_pageview: "history_change",
  capture_pageleave: true,
  capture_exceptions: true,
  capture_performance: { web_vitals: true, network_timing: true },
  capture_dead_clicks: true,
  enable_heatmaps: true,
  respect_dnt: true,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: setup.environment === "production" ? "*" : "[data-ph-mask]",
    recordHeaders: false,
    recordBody: false,
    captureJsonLd: false
  },
  before_send: (capture) => capture === null ? null : templateCapture(capture, options.origin)
})
