import { Effect, Predicate, type Redacted } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"

import { ToolFailed } from "../errors.ts"

/** PostHog's REST API for one project, with a personal API key. */
export interface PostHogApi {
  /** The app's host (`https://us.posthog.com`), not the ingestion host. */
  readonly host: string
  readonly key: Redacted.Redacted<string>
}

/** A row of one of PostHog's lists: what `apply` reads of any object. */
export type Row = Readonly<Record<string, unknown>> & { readonly id: number; readonly name?: string | null }

/**
 * The app host for an ingestion host: `https://us.i.posthog.com` is `https://us.posthog.com`. Other hosts (self
 * hosted, a proxy) are taken as they are.
 */
export const appHost = (ingestHost: string): string =>
  ingestHost.replace(/\/+$/, "").replace(/^(https:\/\/[a-z]+)\.i\.posthog\.com$/, "$1.posthog.com")

/** Calls `method path` with `body` as JSON, failing with PostHog's own words when it refuses. */
export const call = Effect.fn("posthog.call")(function*(
  api: PostHogApi,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown
) {
  const client = yield* HttpClient.HttpClient
  const url = path.startsWith("https://") ? path : `${api.host}${path}`
  const request = HttpClientRequest.make(method)(url).pipe(
    HttpClientRequest.bearerToken(api.key),
    HttpClientRequest.acceptJson,
    body === undefined ? (request) => request : HttpClientRequest.bodyJsonUnsafe(body)
  )
  const failed = (output: string) => ToolFailed.make({ tool: `posthog ${method} ${path}`, output })

  const response = yield* client.execute(request).pipe(Effect.mapError((cause) => failed(cause.message)))
  const json = yield* response.json.pipe(Effect.mapError(() => failed(`${response.status}: not JSON`)))
  if (response.status >= 400) {
    const detail = Predicate.isObject(json) && "detail" in json ? String(json.detail) : JSON.stringify(json)
    return yield* failed(`${response.status}: ${detail}`)
  }
  return json as Readonly<Record<string, unknown>>
})

/** Every row of a paginated list (`results`, then `next`), deleted ones left out. */
export const list = Effect.fn("posthog.list")(function*(api: PostHogApi, path: string) {
  const rows: Array<Row> = []
  let next: string | null = `${path}?limit=200`
  while (next !== null) {
    const page: Readonly<Record<string, unknown>> = yield* call(api, "GET", next)
    rows.push(...(page.results as ReadonlyArray<Row>))
    next = typeof page.next === "string" ? page.next : null
  }
  return rows.filter((row) => row.deleted !== true)
})
