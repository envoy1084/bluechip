import { Effect, Predicate, type Redacted } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"

import { ToolFailed } from "../errors.ts"

/** Axiom's management API, with an advanced or personal token that may manage datasets and dashboards. */
export interface AxiomApi {
  readonly host: string
  readonly token: Redacted.Redacted<string>
}

/** Axiom's management API host; ingestion goes to the server's `AXIOM_DOMAIN`, not here. */
export const AXIOM_API_HOST = "https://api.axiom.co"

/** Calls `method path` with `body` as JSON, failing with Axiom's own words when it refuses. */
export const call = Effect.fn("axiom.call")(function*(
  api: AxiomApi,
  method: "GET" | "POST",
  path: string,
  body?: unknown
) {
  const client = yield* HttpClient.HttpClient
  const request = HttpClientRequest.make(method)(`${api.host}${path}`).pipe(
    HttpClientRequest.bearerToken(api.token),
    HttpClientRequest.acceptJson,
    body === undefined ? (request) => request : HttpClientRequest.bodyJsonUnsafe(body)
  )
  const failed = (output: string) => ToolFailed.make({ tool: `axiom ${method} ${path}`, output })

  const response = yield* client.execute(request).pipe(Effect.mapError((cause) => failed(cause.message)))
  const json = yield* response.json.pipe(Effect.mapError(() => failed(`${response.status}: not JSON`)))
  if (response.status >= 400) {
    const detail = Predicate.isObject(json) && "message" in json ? String(json.message) : JSON.stringify(json)
    return yield* failed(`${response.status}: ${detail}`)
  }
  return json
})
