// PostHog's query nodes (the `query` of a saved insight), as its API takes them.

type Node = Readonly<Record<string, unknown>>

/** An event property filter (`type: "person"` for a person property). */
export const where = (key: string, value: unknown, operator = "exact", type = "event"): Node => ({
  key,
  value: operator === "exact" && !Array.isArray(value) ? [value] : value,
  operator,
  type
})

/** One event series, optionally filtered and with a math (`dau`, `sum` of a property, `p95`, …). */
export const event = (
  name: string | null,
  options: {
    readonly where?: ReadonlyArray<Node>
    readonly math?: string
    readonly property?: string
    readonly label?: string
  } = {}
): Node => ({
  kind: "EventsNode",
  event: name,
  name: name ?? "All events",
  ...(options.label === undefined ? {} : { custom_name: options.label }),
  ...(options.math === undefined ? {} : { math: options.math }),
  ...(options.property === undefined ? {} : { math_property: options.property }),
  ...(options.where === undefined ? {} : { properties: options.where })
})

/** A breakdown by an event property, a person property or a HogQL expression. */
interface Breakdown {
  readonly by: string
  readonly type?: "event" | "person" | "hogql"
  readonly limit?: number
}

const breakdownFilter = (breakdown: Breakdown | undefined): Node =>
  breakdown === undefined ? {} : {
    breakdownFilter: {
      breakdown: breakdown.by,
      breakdown_type: breakdown.type ?? "event",
      ...(breakdown.limit === undefined ? {} : { breakdown_limit: breakdown.limit })
    }
  }

const viz = (source: Node): Node => ({ kind: "InsightVizNode", source })

/** Steps in order (not strict), converting within a window, over the last 30 days unless said. */
export const funnel = (
  steps: ReadonlyArray<Node>,
  options: {
    readonly window: readonly [number, "hour" | "day"]
    readonly breakdown?: Breakdown
    readonly from?: string
    readonly timeToConvert?: boolean
  }
): Node =>
  viz({
    kind: "FunnelsQuery",
    series: steps,
    dateRange: { date_from: options.from ?? "-30d" },
    filterTestAccounts: true,
    funnelsFilter: {
      funnelOrderType: "ordered",
      funnelVizType: options.timeToConvert === true ? "time_to_convert" : "steps",
      funnelWindowInterval: options.window[0],
      funnelWindowIntervalUnit: options.window[1]
    },
    ...breakdownFilter(options.breakdown)
  })

/** Series per day (or week), over the last 30 days unless said. */
export const trends = (
  series: ReadonlyArray<Node>,
  options: {
    readonly interval?: "day" | "week"
    readonly breakdown?: Breakdown
    readonly from?: string
    readonly formula?: string
    readonly display?: "ActionsLineGraph" | "ActionsBar" | "ActionsTable" | "ActionsPie" | "BoldNumber"
  } = {}
): Node =>
  viz({
    kind: "TrendsQuery",
    series,
    interval: options.interval ?? "day",
    dateRange: { date_from: options.from ?? "-30d" },
    filterTestAccounts: true,
    ...breakdownFilter(options.breakdown),
    trendsFilter: {
      display: options.display ?? "ActionsLineGraph",
      ...(options.formula === undefined ? {} : { formula: options.formula })
    }
  })

/** Weekly retention from `start` to `returning` (an event name, or an action's id). */
export const retention = (
  start: string,
  returning: { readonly event: string } | { readonly action: number | undefined },
  options: { readonly cumulative?: boolean } = {}
): Node =>
  viz({
    kind: "RetentionQuery",
    dateRange: { date_from: "-8w" },
    filterTestAccounts: true,
    retentionFilter: {
      period: "Week",
      totalIntervals: 8,
      retentionType: "retention_first_time",
      cumulative: options.cumulative ?? false,
      targetEntity: { id: start, name: start, type: "events" },
      returningEntity: "event" in returning
        ? { id: returning.event, name: returning.event, type: "events" }
        : { id: returning.action ?? null, type: "actions" }
    }
  })

/** Days per week each identified person was active. */
export const stickiness = (series: ReadonlyArray<Node>): Node =>
  viz({ kind: "StickinessQuery", series, interval: "day", dateRange: { date_from: "-30d" }, filterTestAccounts: true })

/** The paths people take from or to an event, through custom events and pageviews. */
export const paths = (point: { readonly from: string } | { readonly to: string }): Node =>
  viz({
    kind: "PathsQuery",
    dateRange: { date_from: "-30d" },
    filterTestAccounts: true,
    pathsFilter: {
      includeEventTypes: ["custom_event", "$pageview"],
      ...("from" in point ? { startPoint: point.from } : { endPoint: point.to }),
      stepLimit: 5
    }
  })
