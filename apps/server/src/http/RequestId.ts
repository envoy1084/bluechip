import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"

/**
 * Every request gets an id (the caller's `x-request-id` or a new UUID), echoed in the response header and attached to
 * every log line written while handling it.
 */
export const RequestIdMiddleware = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const requestId = request.headers["x-request-id"] ?? crypto.randomUUID()
      const response = yield* httpEffect.pipe(Effect.annotateLogs("requestId", requestId))
      return HttpServerResponse.setHeader(response, "x-request-id", requestId)
    }),
  { global: true }
)
