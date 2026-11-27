import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerError from "effect/http/HttpServerError"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import { HttpServerDuration, record } from "../telemetry/Metrics.ts"
import { isUntraced, routeOf } from "../telemetry/SpanNames.ts"

/** The header the web app sends with PostHog's replay session id, so a trace links to its replay. */
export const replaySessionHeader = "x-bluechip-replay-session"

/**
 * Every request's telemetry beside its span:
 *
 * - its duration (`http.server.request.duration`) by route, method and status class, sampled or not, so dashboards
 *   count what traces skip; `error.type` is the status of a 4xx or 5xx (`none` otherwise). The live event stream is
 *   left out: it lasts as long as the tab stays open;
 * - the replay session (`x-bluechip-replay-session`) on the request's span as `posthog.session_id`;
 * - no spans at all under an untraced route (`isUntraced`): its handler's own spans would start traces of their own.
 */
export const RequestTelemetryMiddleware = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const route = routeOf(request.method, request.url)
      const handled = isUntraced(request) ? Effect.withTracerEnabled(httpEffect, false) : httpEffect
      if (route === "/api/events") return yield* handled

      const session = request.headers[replaySessionHeader]
      if (session !== undefined && session.length <= 128) {
        yield* Effect.annotateCurrentSpan("posthog.session_id", session)
      }

      const [took, exit] = yield* Effect.timed(Effect.exit(handled))
      const status = Exit.isSuccess(exit)
        ? exit.value.status
        : (yield* HttpServerError.causeResponse(exit.cause))[0].status
      yield* record(HttpServerDuration, Duration.toMillis(took), {
        "http.route": route,
        "http.request.method": request.method,
        "http.response.status_class": `${Math.floor(status / 100)}xx`,
        "error.type": status >= 400 ? String(status) : "none"
      })
      return yield* exit
    }),
  { global: true }
)
