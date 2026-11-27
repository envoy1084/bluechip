import * as ByteSize from "effect/ByteSize"
import * as Effect from "effect/Effect"
import { constTrue } from "effect/Function"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage"
import * as HttpMiddleware from "effect/http/HttpMiddleware"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as RateLimiter from "effect/persistence/RateLimiter"
import { gunzipSync } from "node:zlib"
import { stampJson, stampProtobuf } from "./OtlpStamp.ts"
import { axiomHeaders } from "./Telemetry.ts"
import { TelemetryConfig } from "./TelemetryConfig.ts"

// Session recordings are the largest PostHog bodies; a browser's OTLP batch is a few kilobytes.
const INGEST_MAX_BYTES = 5 * 1024 * 1024
const OTLP_MAX_BYTES = 1024 * 1024

// Requests a minute per address: posthog-js sends a batch every few seconds and recordings in chunks; the OTLP
// exporters a batch per signal every few seconds.
const INGEST_PER_MINUTE = 600
const OTLP_PER_MINUTE = 240

// Only what the upstream needs from the browser: never its cookies.
const FORWARDED_HEADERS = ["content-type", "content-encoding", "user-agent", "accept"]
const RETURNED_HEADERS = ["content-type", "cache-control", "retry-after"]

const tooMany = HttpServerResponse.empty({ status: 429, headers: { "retry-after": "60" } })

// The address a request came from: the proxy's first hop when behind one, else the socket's.
const addressOf = (request: HttpServerRequest.HttpServerRequest) =>
  request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    Option.getOrElse(request.remoteAddress, () => "unknown")

const pathAndQueryOf = (url: string) => {
  const parsed = new URL(url, "http://bluechip")
  return { path: parsed.pathname, query: parsed.search }
}

/**
 * The web app's telemetry, through the server, so the browser talks only to bluechip's origin (ad blockers and
 * cross-origin rules leave it alone) and holds no Axiom token. Neither route is traced or logged per request.
 *
 * - `* /ingest/*`: PostHog's ingest (`POSTHOG_HOST`, `/ingest/static/*` from `POSTHOG_ASSETS_HOST`), path and query
 *   as sent, with the browser's address as `x-forwarded-for` (PostHog's country) and no cookies. `404` outside paper
 *   and production.
 * - `POST /api/telemetry/v1/{traces,logs,metrics}`: OTLP (`application/json` or `application/x-protobuf`, gzip or
 *   not), each resource given `deployment.environment` and `network` when it lacks them, forwarded uncompressed to
 *   Axiom's dataset for the signal with the server's ingest token. `204` (accepted, dropped) when Axiom is off, `415`
 *   for another content type, `400` for a body that doesn't decode.
 *
 * Both answer `413` over their size (5 MiB, 1 MiB) and `429` past their rate per address (600, 240 a minute).
 */
export const TelemetryProxyRoutes = Layer.effectDiscard(Effect.gen(function*() {
  const config = yield* TelemetryConfig
  const router = yield* HttpRouter.HttpRouter
  const limiter = yield* RateLimiter.RateLimiter
  // No span or trace headers of its own: the route isn't traced either.
  const upstream = (yield* HttpClient.HttpClient).pipe(
    HttpClient.transformResponse(Effect.provideService(HttpClient.TracerDisabledWhen, constTrue))
  )

  const within = (request: HttpServerRequest.HttpServerRequest, key: string, limit: number) =>
    limiter.consume({ key: `${key}:${addressOf(request)}`, limit, window: "1 minute" }).pipe(
      Effect.match({ onFailure: () => false, onSuccess: () => true })
    )

  const readBody = (request: HttpServerRequest.HttpServerRequest, limit: number) => {
    const length = Number(request.headers["content-length"] ?? "0")
    if (!Number.isFinite(length) || length > limit) return Effect.succeed(undefined)
    return request.arrayBuffer.pipe(
      Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(limit)),
      Effect.map((body) => new Uint8Array(body)),
      Effect.orElseSucceed(() => undefined)
    )
  }

  const respond = (outbound: HttpClientRequest.HttpClientRequest) =>
    upstream.execute(HttpClientRequest.setHeader(outbound, "accept-encoding", "identity")).pipe(
      Effect.flatMap((response) =>
        Effect.map(response.arrayBuffer, (body) => {
          const headers: Record<string, string> = {}
          for (const name of RETURNED_HEADERS) {
            const value = response.headers[name]
            if (value !== undefined && name !== "content-type") headers[name] = value
          }
          return body.byteLength === 0
            ? HttpServerResponse.empty({ status: response.status, headers })
            : HttpServerResponse.uint8Array(new Uint8Array(body), {
              status: response.status,
              headers,
              ...(response.headers["content-type"] === undefined
                ? {}
                : { contentType: response.headers["content-type"] })
            })
        })
      ),
      Effect.timeout("15 seconds"),
      Effect.catchTags({
        TimeoutError: () => Effect.succeed(HttpServerResponse.empty({ status: 504 })),
        HttpClientError: () => Effect.succeed(HttpServerResponse.empty({ status: 502 }))
      })
    )

  const ingest = Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const posthog = config.posthog
    if (posthog === undefined) return HttpServerResponse.empty({ status: 404 })
    if (!(yield* within(request, "ingest", INGEST_PER_MINUTE))) return tooMany

    const { path, query } = pathAndQueryOf(request.url)
    const rest = path.replace(/^\/ingest/, "") || "/"
    const host = rest.startsWith("/static/") ? posthog.assets : posthog.ingest
    let outbound = HttpClientRequest.make(request.method as "GET")(`${host}${rest}${query}`)
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers[name]
      if (value !== undefined && name !== "content-type") outbound = HttpClientRequest.setHeader(outbound, name, value)
    }
    outbound = HttpClientRequest.setHeader(outbound, "x-forwarded-for", addressOf(request))
    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = yield* readBody(request, INGEST_MAX_BYTES)
      if (body === undefined) return HttpServerResponse.empty({ status: 413 })
      outbound = HttpClientRequest.bodyUint8Array(
        outbound,
        body,
        request.headers["content-type"] ?? "application/octet-stream"
      )
    }
    return yield* respond(outbound)
  }).pipe(HttpMiddleware.withLoggerDisabled)

  const otlp = Effect.fnUntraced(function*(signal: "traces" | "logs" | "metrics") {
    const request = yield* HttpServerRequest.HttpServerRequest
    const axiom = config.axiom
    if (axiom === undefined) return HttpServerResponse.empty({ status: 204 })
    const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase()
    if (contentType !== "application/json" && contentType !== "application/x-protobuf") {
      return HttpServerResponse.empty({ status: 415 })
    }
    if (!(yield* within(request, "otlp", OTLP_PER_MINUTE))) return tooMany

    const body = yield* readBody(request, OTLP_MAX_BYTES)
    if (body === undefined) return HttpServerResponse.empty({ status: 413 })
    const stamps = { "deployment.environment": config.environment, network: config.network }
    const stamped = yield* Effect.try(() => {
      const raw = request.headers["content-encoding"] === "gzip" ? gunzipSync(body) : body
      return contentType === "application/json"
        ? new TextEncoder().encode(stampJson(new TextDecoder().decode(raw), stamps))
        : stampProtobuf(raw, stamps)
    }).pipe(Effect.option)
    if (Option.isNone(stamped)) return HttpServerResponse.empty({ status: 400 })

    return yield* respond(
      HttpClientRequest.post(`${axiom.url}/v1/${signal}`).pipe(
        HttpClientRequest.setHeaders(axiomHeaders(axiom, signal)),
        HttpClientRequest.bodyUint8Array(stamped.value, contentType)
      )
    )
  }, HttpMiddleware.withLoggerDisabled)

  yield* router.add("*", "/ingest/*", ingest)
  for (const signal of ["traces", "logs", "metrics"] as const) {
    yield* router.add("POST", `/api/telemetry/v1/${signal}`, otlp(signal))
  }
})).pipe(Layer.provide(RateLimiter.layer), Layer.provide(RateLimiter.layerStoreMemory))
