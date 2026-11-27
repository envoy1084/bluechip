import { contractVersionHeader } from "@bluechip/domain/Contract"
import * as Effect from "effect/Effect"
import * as HttpMiddleware from "effect/http/HttpMiddleware"
import * as HttpRouter from "effect/http/HttpRouter"
import { AppConfig } from "../../config/AppConfig.ts"
import { replaySessionHeader } from "./RequestTelemetry.ts"

/**
 * Lets the web app (`PUBLIC_ORIGIN`) call the server from its own origin with the session cookie: on paper and
 * production the API has a domain of its own (`api.bluechip.markets`). Any other origin gets no
 * `Access-Control-Allow-Origin`, so its page can't read an answer; `OriginCheckMiddleware` refuses its writes.
 * Preflights are answered here, before authentication, and cached by the browser for two hours.
 */
export const CorsMiddleware = HttpRouter.middleware(
  Effect.gen(function*() {
    const config = yield* AppConfig
    return HttpMiddleware.cors({
      allowedOrigins: (origin) => origin === config.publicOrigin,
      allowedMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
      // The page's own headers: the contract version, the replay's session and its traces' context.
      allowedHeaders: ["content-type", contractVersionHeader, replaySessionHeader, "traceparent", "tracestate", "b3"],
      credentials: true,
      maxAge: 7200
    })
  }),
  { global: true }
)
