import type { ProjectName, Refs } from "./Spec.ts"

/** Where each project's web app runs: replay and heatmaps record only there, and the toolbar opens there. */
export const APP_URLS: Readonly<Record<ProjectName, ReadonlyArray<string>>> = {
  production: ["https://bluechip.markets"],
  paper: ["https://paper.bluechip.markets", "http://localhost:3000"]
}

/** The cohort every insight filters out by default (the project's test-account filter). */
export const INTERNAL_COHORT = "Internal and test"

/** The dashboard a project opens on. */
export const HOME_DASHBOARD = "bluechip: Growth"

/**
 * The project's settings. Production masks all text in replays (balances, holdings and chat are text), paper only
 * inputs. Replays are sampled at 25%, and recorded whenever an error or a failed passkey prompt happens. IPs are
 * dropped after PostHog derives the country.
 */
export const settings = (project: ProjectName, refs: Refs): Readonly<Record<string, unknown>> => ({
  anonymize_ips: true,
  timezone: "UTC",
  app_urls: APP_URLS[project],
  recording_domains: APP_URLS[project],
  autocapture_opt_out: true,
  autocapture_exceptions_opt_in: true,
  autocapture_web_vitals_opt_in: true,
  autocapture_web_vitals_allowed_metrics: ["LCP", "CLS", "FCP", "INP"],
  capture_performance_opt_in: true,
  capture_console_log_opt_in: false,
  capture_dead_clicks: true,
  heatmaps_opt_in: true,
  session_recording_opt_in: true,
  session_recording_sample_rate: "0.25",
  session_recording_minimum_duration_milliseconds: 2000,
  session_recording_masking_config: project === "production"
    ? { maskAllInputs: true, maskTextSelector: "*" }
    : { maskAllInputs: true },
  session_recording_network_payload_capture_config: { recordHeaders: false, recordBody: false },
  session_recording_event_trigger_config: ["$exception", "api_error", "passkey_prompt_failed"],
  session_recording_trigger_match_type_config: "any",
  person_display_name_properties: ["$user_id"],
  test_account_filters: [
    { key: "id", type: "cohort", value: refs.cohort(INTERNAL_COHORT) ?? null, operator: "not_in" },
    { key: "$host", type: "event", value: ["localhost:3000"], operator: "is_not" }
  ],
  test_account_filters_default_checked: true,
  primary_dashboard: refs.dashboard(HOME_DASHBOARD) ?? null
})

/** What the API can't set, as clicks in PostHog (https://us.posthog.com). */
export const manualSteps = (project: ProjectName): ReadonlyArray<string> => [
  `Billing limits: Organization settings > Billing: set a $0 limit on Product analytics, Session replay and LLM analytics so the free tier never charges.`,
  `Mark yourself internal: People > open your person > add property $internal_or_test_user = true (or the toolbar's "Mark as internal"), so the "${INTERNAL_COHORT}" cohort and the test-account filter leave you out.`,
  `Errored sessions playlist: Session replay > Playlists > New playlist "bluechip: errored sessions", filter Events: $exception or api_error, Save, then pin it to "bluechip: Web quality".`,
  `LLM analytics: open LLM analytics once (left menu > LLM analytics) so it shows the server's $ai_generation events; no SDK setup is needed.`,
  `Region and retention are fixed by the plan: US cloud, 30-day replays${
    project === "paper" ? "" : "; check Settings > Project > Data retention after an upgrade"
  }.`
]
