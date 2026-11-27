// PostHog's and Axiom's ingest at the edge, in process, and the telemetry proxy in front of it: records what the telemetry proxy forwards (where, its
// headers and its body) and answers 200 with a small JSON body.
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"
import { TelemetryConfig } from "../../src/platform/telemetry/TelemetryConfig.ts"
import { TelemetryProxyRoutes } from "../../src/platform/telemetry/TelemetryProxy.ts"

/** A request as the upstream received it. */
export interface UpstreamRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: Uint8Array | undefined
}

export class TelemetryUpstreamTest extends Context.Service<TelemetryUpstreamTest, {
  /** Every request forwarded, oldest first. */
  readonly received: Effect.Effect<ReadonlyArray<UpstreamRequest>>
}>()("@bluechip/server/test/TelemetryUpstreamTest") {
  /** The recordings and the `HttpClient` the proxy forwards with. */
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const received: Array<UpstreamRequest> = []
    const client = HttpClient.make((request, url) =>
      Effect.sync(() => {
        const body = request.body._tag === "Uint8Array" ? request.body.body : undefined
        received.push({ method: request.method, url: url.toString(), headers: request.headers, body })
        return HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify({ status: 1 }), {
            status: 200,
            headers: { "content-type": "application/json", "set-cookie": "upstream=1" }
          })
        )
      })
    )
    return Layer.merge(
      Layer.succeed(TelemetryUpstreamTest, { received: Effect.sync(() => [...received]) }),
      Layer.succeed(HttpClient.HttpClient, client)
    )
  }))

  /** The proxy's routes as the server mounts them, on `config`, answering requests in memory, with what they sent. */
  static readonly proxy = Effect.fnUntraced(function*(config: TelemetryConfig["Service"]) {
    const upstream = yield* Layer.build(TelemetryUpstreamTest.layer)
    const { dispose, handler } = HttpRouter.toWebHandler(
      TelemetryProxyRoutes.pipe(
        Layer.provide(Layer.succeedContext(upstream)),
        Layer.provide(Layer.succeed(TelemetryConfig, config))
      ),
      { disableLogger: true }
    )
    yield* Effect.addFinalizer(() => Effect.promise(dispose))
    return {
      send: (path: string, init?: RequestInit) =>
        Effect.promise(() => handler(new Request(`http://bluechip${path}`, init))),
      received: Effect.provideContext(TelemetryUpstreamTest.use((test) => test.received), upstream)
    }
  })
}
