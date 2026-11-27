import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpMiddleware from "effect/http/HttpMiddleware"
import * as Layer from "effect/Layer"
import * as Metric from "effect/Metric"
import * as OtlpExporter from "effect/observability/OtlpExporter"
import * as OtlpLogger from "effect/observability/OtlpLogger"
import * as OtlpMetrics from "effect/observability/OtlpMetrics"
import * as OtlpSerialization from "effect/observability/OtlpSerialization"
import * as OtlpTracer from "effect/observability/OtlpTracer"
import * as Redacted from "effect/Redacted"
import * as Tracer from "effect/Tracer"
import { hostname } from "node:os"
import * as BluechipTracer from "./BluechipTracer.ts"
import { isUntraced, spanNameOf } from "./SpanNames.ts"
import { type AxiomConfig, TelemetryConfig } from "./TelemetryConfig.ts"

/**
 * The background runs that may find nothing due. Each sets `bluechip.idle` on its span when it did nothing, and the
 * tracer drops it with everything under it.
 */
export const TICKS: ReadonlySet<string> = new Set([
  "ScheduleWatcher.runDue",
  "PortfolioWatcher.check",
  "ClusterCron/notifications.outbox.run",
  "TelemetryGauges.sample"
])

/** Axiom's OTLP endpoints take the dataset in a header: `x-axiom-dataset`, or `x-axiom-metrics-dataset` for metrics. */
export const axiomHeaders = (axiom: AxiomConfig, signal: "traces" | "logs" | "metrics") => ({
  authorization: `Bearer ${Redacted.value(axiom.token)}`,
  [signal === "metrics" ? "x-axiom-metrics-dataset" : "x-axiom-dataset"]: axiom.datasets[signal]
})

// Each signal its own exporter: traces and logs use the same header with different datasets, and metrics another.
const exporters = (config: TelemetryConfig["Service"], axiom: AxiomConfig) => {
  const resource = {
    serviceName: "bluechip-server",
    serviceVersion: config.release,
    attributes: { "deployment.environment": config.environment, network: config.network, "host.name": hostname() }
  }
  const common = { resource, compression: "gzip" as const, shutdownTimeout: "5 seconds" as const }

  const tracer = Layer.effect(
    Tracer.Tracer,
    Effect.gen(function*() {
      const otlp = yield* OtlpTracer.make({
        ...common,
        url: `${axiom.url}/v1/traces`,
        headers: axiomHeaders(axiom, "traces"),
        exportInterval: "10 seconds"
      })
      return BluechipTracer.make(otlp, {
        sampleReads: config.sampleReads,
        ticks: TICKS,
        context: yield* Effect.context<never>()
      })
    })
  ).pipe(Layer.provideMerge(OtlpExporter.layerFlusher))

  const logger = OtlpLogger.layer({
    ...common,
    url: `${axiom.url}/v1/logs`,
    headers: axiomHeaders(axiom, "logs"),
    exportInterval: "10 seconds",
    excludeLogSpans: true,
    mergeWithExisting: true
  })

  const metrics = OtlpMetrics.layer({
    ...common,
    url: `${axiom.url}/v1/metrics`,
    headers: axiomHeaders(axiom, "metrics"),
    exportInterval: "60 seconds",
    temporality: "delta"
  })

  return Layer.mergeAll(tracer, logger, metrics, Metric.enableRuntimeMetricsLayer).pipe(
    Layer.provide(Layer.merge(OtlpSerialization.layerProtobuf, FetchHttpClient.layer))
  )
}

/**
 * The server's telemetry: requests' spans named by route (`POST /api/trades/:id/confirm`) and none for the routes
 * `isUntraced` lists; then, where `TelemetryConfig` has Axiom (paper and production), spans through
 * `BluechipTracer`, logs beside the console's, and metrics, each exported to its Axiom dataset over OTLP (protobuf,
 * gzip) and flushed when the server stops. Elsewhere nothing leaves the process.
 */
export const TelemetryLive = Layer.unwrap(Effect.gen(function*() {
  const config = yield* TelemetryConfig
  const http = Layer.mergeAll(
    Layer.succeed(HttpMiddleware.SpanNameGenerator, spanNameOf),
    Layer.succeed(HttpMiddleware.TracerDisabledWhen, isUntraced)
  )
  if (config.axiom === undefined) return http
  yield* Effect.logInfo(
    `Telemetry: exporting to Axiom (${config.environment}, ${config.network}), ${config.sampleReads * 100}% of reads`
  )
  return Layer.merge(http, exporters(config, config.axiom))
})).pipe(Layer.provideMerge(TelemetryConfig.layer))
