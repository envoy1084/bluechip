import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import { AppConfig } from "../../config/AppConfig.ts"

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * Refuses state-changing requests a browser sends from another site (cross-site request forgery). Browsers always
 * send `Origin` on such requests; requests without it (curl, server-to-server) carry no cookies a site could abuse.
 */
export const OriginCheckMiddleware = HttpRouter.middleware(
  Effect.gen(function*() {
    const config = yield* AppConfig
    return (httpEffect) =>
      Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const origin = request.headers["origin"]
        if (safeMethods.has(request.method) || origin === undefined || origin === config.publicOrigin) {
          return yield* httpEffect
        }
        yield* Effect.logWarning("Refused a cross-site request", { origin, url: request.url })
        return HttpServerResponse.jsonUnsafe({ _tag: "Forbidden" }, { status: 403 })
      })
  }),
  { global: true }
)
