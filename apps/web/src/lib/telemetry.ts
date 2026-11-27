// The browser's own traces, logs and metrics, exported as OTLP to bluechip's server (`/api/sync/{t,l,m}`), which
// forwards them to Axiom with its own token. API calls carry W3C `traceparent`, so a page's request and the server's
// work for it are one trace.
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Metric from "effect/Metric"
import * as OtlpExporter from "effect/observability/OtlpExporter"
import * as OtlpLogger from "effect/observability/OtlpLogger"
import * as OtlpMetrics from "effect/observability/OtlpMetrics"
import * as OtlpSerialization from "effect/observability/OtlpSerialization"
import * as OtlpTracer from "effect/observability/OtlpTracer"
import * as Option from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as Tracer from "effect/Tracer"
import type { AnalyticsSetup } from "./analyticsSetup.ts"
import { apiUrl } from "./api/origin.ts"
import { templatePath } from "./pagePath.ts"

/** The share of page sessions whose traces are kept. Errors are logs, kept from every session. */
export const TRACE_SAMPLE_RATE = 0.2

/**
 * Whether this tab's session keeps its traces: the decision already stored for it (`"1"` or `"0"`), or a new one from
 * `roll` (uniform in [0, 1)).
 */
export const sessionSampled = (stored: string | null, roll: number): boolean =>
  stored === "1" ? true : stored === "0" ? false : roll < TRACE_SAMPLE_RATE

// The live stream never ends, and telemetry's own export would trace itself.
const UNTRACED_PREFIXES = ["/api/sync/"]

/** Whether a request from the page gets no client span (and so no `traceparent`). */
export const untracedRequest = (pathname: string): boolean =>
  pathname === "/api/events" || UNTRACED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

/** A request's client span name by route: `POST /api/trades/:id/confirm`. */
export const requestSpanName = (method: string, pathname: string): string => `${method} ${templatePath(pathname)}`

const SAMPLED_KEY = "bluechip.telemetry.sampled"

const readSampled = (): boolean => {
  try {
    const sampled = sessionSampled(sessionStorage.getItem(SAMPLED_KEY), Math.random())
    sessionStorage.setItem(SAMPLED_KEY, sampled ? "1" : "0")
    return sampled
  } catch {
    // Storage is off (a private window): decide for this page alone.
    return sessionSampled(null, Math.random())
  }
}

const MILLISECOND_BOUNDARIES = [100, 200, 500, 800, 1000, 1800, 2500, 3000, 4000, 6000, 10_000]

const vitals = {
  CLS: Metric.histogram("web.vitals.cls", {
    description: "Cumulative layout shift of a page view",
    boundaries: [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 1]
  }),
  FCP: Metric.histogram("web.vitals.fcp", {
    description: "First contentful paint, in milliseconds",
    boundaries: MILLISECOND_BOUNDARIES
  }),
  INP: Metric.histogram("web.vitals.inp", {
    description: "Interaction to next paint, in milliseconds",
    boundaries: MILLISECOND_BOUNDARIES
  }),
  LCP: Metric.histogram("web.vitals.lcp", {
    description: "Largest contentful paint, in milliseconds",
    boundaries: MILLISECOND_BOUNDARIES
  }),
  TTFB: Metric.histogram("web.vitals.ttfb", {
    description: "Time to the first byte of the page, in milliseconds",
    boundaries: MILLISECOND_BOUNDARIES
  })
} as const

interface Started {
  readonly runtime: ManagedRuntime.ManagedRuntime<OtlpExporter.Flusher, never>
  readonly sampled: boolean
}

let started: Started | null = null

const nanos = (epochMs: number) => BigInt(Math.round(epochMs * 1_000_000))

const exporters = (setup: AnalyticsSetup) => {
  const resource = {
    serviceName: "bluechip-web",
    serviceVersion: setup.appVersion,
    attributes: { "deployment.environment": setup.environment, network: setup.network }
  }
  // Short, neutral paths: ad blockers drop requests to ones that look like telemetry.
  const url = (signal: "traces" | "logs" | "metrics") => apiUrl(`/api/sync/${signal[0]}`)
  // `keepalive` lets the last batch leave while the tab closes.
  const fetchClient = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { keepalive: true }))
  )
  return Layer.mergeAll(
    OtlpTracer.layer({ url: url("traces"), resource, exportInterval: "5 seconds" }),
    OtlpLogger.layer({
      url: url("logs"),
      resource,
      exportInterval: "5 seconds",
      excludeLogSpans: true,
      mergeWithExisting: true
    }),
    OtlpMetrics.layer({ url: url("metrics"), resource, exportInterval: "30 seconds", temporality: "delta" })
  ).pipe(Layer.provide([OtlpSerialization.layerJson, fetchClient]))
}

const requestTracing = (sampled: boolean) =>
  Layer.mergeAll(
    Layer.succeed(HttpClient.SpanNameGenerator, (request) =>
      requestSpanName(request.method, new URL(request.url).pathname)),
    Layer.succeed(HttpClient.TracerDisabledWhen, (request) =>
      untracedRequest(new URL(request.url).pathname)),
    // An unsampled session still sends `traceparent`, flagged unsampled, so the server keeps none of it either.
    Layer.succeed(Tracer.MinimumTraceLevel, sampled ? "All" : "None")
  )

const run = (effect: Effect.Effect<void, never, OtlpExporter.Flusher>) => {
  if (started === null) return
  started.runtime.runFork(effect)
}

/** Reports an error the page didn't handle, as an error log with the route it happened on. */
export const reportError = (error: unknown) => {
  const { name, message, stack } = error instanceof Error ?
    error :
    { name: "NonError", message: String(error), stack: undefined }
  run(
    Effect.logError("The page failed").pipe(
      Effect.annotateLogs({
        "page.route": templatePath(location.pathname),
        "exception.type": name,
        "exception.message": message,
        ...(stack === undefined ? {} : { "exception.stacktrace": stack })
      })
    )
  )
}

/**
 * Records a page that finished loading as a span, from when it started (`startMs`, epoch milliseconds) to now: the
 * first load (`kind: "load"`, from the browser's navigation start, with its timings) or a move between routes.
 */
export const recordPage = (
  kind: "load" | "navigation",
  pathname: string,
  startMs: number,
  attributes: Readonly<Record<string, unknown>> = {}
) => {
  if (started === null) return
  const { sampled } = started
  run(Effect.gen(function*() {
    const tracer = yield* Effect.tracer
    const route = templatePath(pathname)
    const span = tracer.span({
      name: `page.${kind} ${route}`,
      parent: Option.none(),
      annotations: Context.empty(),
      links: [],
      startTime: nanos(startMs),
      kind: "client",
      root: true,
      sampled
    })
    span.attribute("page.route", route)
    for (const [name, value] of Object.entries(attributes)) span.attribute(name, value)
    span.end(nanos(Date.now()), Exit.void)
  }))
}

const startVitals = async () => {
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals")
  const record = (vital: { readonly name: keyof typeof vitals; readonly value: number; readonly rating: string }) =>
    run(
      Metric.update(
        Metric.withAttributes(vitals[vital.name], {
          "page.route": templatePath(location.pathname),
          rating: vital.rating
        }),
        vital.value
      )
    )
  onCLS(record)
  onFCP(record)
  onINP(record)
  onLCP(record)
  onTTFB(record)
}

/**
 * Starts the browser's telemetry, before the app renders: the OTLP exporters, the API client's spans (named by route,
 * `traceparent` on every `/api` call) for every atom, errors as logs and web vitals as metrics. Traces are kept for
 * {@link TRACE_SAMPLE_RATE} of sessions.
 */
export const startTelemetry = async (setup: AnalyticsSetup): Promise<void> => {
  const sampled = readSampled()
  const runtime = ManagedRuntime.make(Layer.merge(exporters(setup), requestTracing(sampled)))
  const context = await runtime.context()
  // Every atom runtime (the API client's included) is built on the global layer, so its requests use these exporters.
  Atom.runtime.addGlobalLayer(Layer.succeedContext(context))
  started = { runtime, sampled }

  addEventListener("error", (event) => reportError(event.error ?? event.message))
  addEventListener("unhandledrejection", (event) => reportError(event.reason))
  // A hidden tab may never come back: send what is waiting while it still can.
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      run(Effect.gen(function*() {
        const flusher = yield* OtlpExporter.Flusher
        yield* flusher.flush
      }))
    }
  })
  void startVitals()
}
