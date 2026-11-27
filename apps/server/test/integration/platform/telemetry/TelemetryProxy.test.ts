import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import { gzipSync } from "node:zlib"
import type { TelemetryConfig } from "../../../../src/platform/telemetry/TelemetryConfig.ts"
import { TelemetryUpstreamTest } from "../../../utils/TelemetryUpstreamTest.ts"

const PAPER: TelemetryConfig["Service"] = {
  environment: "paper",
  network: "sepolia",
  release: "0.0.0",
  axiom: {
    token: Redacted.make("ingest-token"),
    url: "https://axiom.test",
    datasets: { traces: "bluechip-traces", logs: "bluechip-logs", metrics: "bluechip-metrics" }
  },
  posthog: { ingest: "https://posthog.test", assets: "https://assets.posthog.test" },
  sampleReads: 1
}
const DEVELOPMENT: TelemetryConfig["Service"] = {
  ...PAPER,
  environment: "development",
  axiom: undefined,
  posthog: undefined
}

const spans = JSON.stringify({ resourceSpans: [{ resource: { attributes: [] }, scopeSpans: [] }] })

describe("the telemetry proxy", () => {
  describe("POST /api/telemetry/v1/:signal", () => {
    it.effect("forwards JSON traces to Axiom's traces dataset with the server's token, stamped", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(PAPER)

        const response = yield* proxy.send("/api/telemetry/v1/traces", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: "bluechip_session=secret" },
          body: spans
        })

        const [sent] = yield* proxy.received
        assert.deepStrictEqual(
          [
            response.status,
            sent!.url,
            sent!.headers["authorization"],
            sent!.headers["x-axiom-dataset"],
            sent!.headers["cookie"]
          ],
          [200, "https://axiom.test/v1/traces", "Bearer ingest-token", "bluechip-traces", undefined]
        )
        assert.deepStrictEqual(JSON.parse(new TextDecoder().decode(sent!.body)).resourceSpans[0].resource.attributes, [
          { key: "deployment.environment", value: { stringValue: "paper" } },
          { key: "network", value: { stringValue: "sepolia" } }
        ])
      }))

    it.effect("sends metrics with the metrics dataset's header, from a gzipped body", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(PAPER)

        const response = yield* proxy.send("/api/telemetry/v1/metrics", {
          method: "POST",
          headers: { "content-type": "application/json", "content-encoding": "gzip" },
          body: gzipSync(JSON.stringify({ resourceMetrics: [] }))
        })

        const [sent] = yield* proxy.received
        assert.deepStrictEqual(
          [response.status, sent!.url, sent!.headers["x-axiom-metrics-dataset"], sent!.headers["content-encoding"]],
          [200, "https://axiom.test/v1/metrics", "bluechip-metrics", undefined]
        )
      }))

    it.effect("415: a body that isn't OTLP", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(PAPER)

        const response = yield* proxy.send("/api/telemetry/v1/logs", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "hello"
        })

        assert.deepStrictEqual([response.status, (yield* proxy.received).length], [415, 0])
      }))

    it.effect("400: JSON that doesn't parse", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(PAPER)

        const response = yield* proxy.send("/api/telemetry/v1/logs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{"
        })

        assert.deepStrictEqual([response.status, (yield* proxy.received).length], [400, 0])
      }))

    it.effect("413: a body over 1 MiB", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(PAPER)

        const response = yield* proxy.send("/api/telemetry/v1/traces", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "x".repeat(1024 * 1024 + 1)
        })

        assert.deepStrictEqual([response.status, (yield* proxy.received).length], [413, 0])
      }))

    it.effect("204 and nothing forwarded where Axiom is off", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(DEVELOPMENT)

        const response = yield* proxy.send("/api/telemetry/v1/traces", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: spans
        })

        assert.deepStrictEqual([response.status, (yield* proxy.received).length], [204, 0])
      }))
  })

  describe("* /ingest/*", () => {
    it.effect("forwards an event batch to PostHog's ingest with its path, query and the browser's address", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(PAPER)

        const response = yield* proxy.send("/ingest/e/?compression=gzip-js&ver=1", {
          method: "POST",
          headers: {
            "content-type": "text/plain",
            cookie: "bluechip_session=secret",
            "x-forwarded-for": "203.0.113.7"
          },
          body: "batch"
        })

        const [sent] = yield* proxy.received
        assert.deepStrictEqual(
          [
            response.status,
            response.headers.get("set-cookie"),
            sent!.method,
            sent!.url,
            sent!.headers["x-forwarded-for"],
            sent!.headers["cookie"],
            new TextDecoder().decode(sent!.body)
          ],
          [200, null, "POST", "https://posthog.test/e/?compression=gzip-js&ver=1", "203.0.113.7", undefined, "batch"]
        )
      }))

    it.effect("loads PostHog's scripts from its assets host", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(PAPER)

        yield* proxy.send("/ingest/static/recorder.js?v=1.2")

        const [sent] = yield* proxy.received
        assert.deepStrictEqual([sent!.method, sent!.url], [
          "GET",
          "https://assets.posthog.test/static/recorder.js?v=1.2"
        ])
      }))

    it.effect("404 and nothing forwarded outside paper and production", () =>
      Effect.gen(function*() {
        const proxy = yield* TelemetryUpstreamTest.proxy(DEVELOPMENT)

        const response = yield* proxy.send("/ingest/e/", { method: "POST", body: "batch" })

        assert.deepStrictEqual([response.status, (yield* proxy.received).length], [404, 0])
      }))
  })
})
