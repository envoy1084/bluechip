/** Marks the objects `posthog apply` owns, at the start of their description, so a rerun finds and updates them. */
export const TAG = "[bluechip]"

/** bluechip's two PostHog projects. */
export type ProjectName = "paper" | "production"

/** The ids of objects made earlier in the same run, by name; `undefined` in a dry run that would make them. */
export interface Refs {
  readonly action: (name: string) => number | undefined
  readonly cohort: (name: string) => number | undefined
  readonly dashboard: (name: string) => number | undefined
}

/** An action or cohort: its name, what it's for, and the rest of its body. */
export interface ObjectSpec {
  readonly name: string
  readonly description: string
  readonly body: Readonly<Record<string, unknown>>
}

/** A saved insight: its name, what it answers, and its query (an `InsightVizNode` or another node). */
export interface InsightSpec {
  readonly name: string
  readonly description: string
  readonly query: (refs: Refs) => unknown
}

/** A dashboard and the insights on it, by name, in order. */
export interface DashboardSpec {
  readonly name: string
  readonly description: string
  readonly insights: ReadonlyArray<string>
}

/** Everything `posthog apply` makes a project say. */
export interface PostHogDesired {
  readonly settings: (refs: Refs) => Readonly<Record<string, unknown>>
  readonly actions: ReadonlyArray<ObjectSpec>
  readonly cohorts: ReadonlyArray<ObjectSpec>
  readonly insights: ReadonlyArray<InsightSpec>
  readonly dashboards: ReadonlyArray<DashboardSpec>
  /** What PostHog's API can't set: exact clicks, printed after every run. */
  readonly manual: ReadonlyArray<string>
}
