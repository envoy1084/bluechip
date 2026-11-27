import { BluechipApi } from "@bluechip/domain/Api"
import type * as HttpServerRequest from "effect/http/HttpServerRequest"

interface Route {
  readonly method: string
  readonly path: string
  readonly segments: ReadonlyArray<string>
  readonly literals: number
}

const segmentsOf = (path: string) => path.split("/").filter((segment) => segment !== "")

// Routes with more literal segments first, so `/api/agents/requests` wins over `/api/agents/:id`.
const ROUTES: ReadonlyArray<Route> = Object.values(BluechipApi.groups)
  .flatMap((group) => Object.values(group.endpoints))
  .map((endpoint) => {
    const segments = segmentsOf(endpoint.path)
    return {
      method: endpoint.method,
      path: endpoint.path,
      segments,
      literals: segments.filter((segment) => !segment.startsWith(":")).length
    }
  })
  .sort((a, b) => b.literals - a.literals)

const pathOf = (url: string) => {
  const end = url.search(/[?#]/)
  return end === -1 ? url : url.slice(0, end)
}

/**
 * The route a request matches, as `BluechipApi` declares it (`/api/trades/:id/confirm`), so ids never reach a span
 * name or a metric; `/health` as is, and `*` for anything else.
 */
export const routeOf = (method: string, url: string): string => {
  const path = pathOf(url)
  if (path === "/health") return path
  const segments = segmentsOf(path)
  const route = ROUTES.find((candidate) =>
    candidate.method === method &&
    candidate.segments.length === segments.length &&
    candidate.segments.every((segment, index) => segment.startsWith(":") || segment === segments[index])
  )
  return route?.path ?? "*"
}

/** A server span's name: the method and the route (`POST /api/trades/:id/confirm`). */
export const spanNameOf = (request: HttpServerRequest.HttpServerRequest) =>
  `${request.method} ${routeOf(request.method, request.url)}`

const UNTRACED = new Set(["/health", "/api/version", "/api/events", "/api/rpc"])

/**
 * Requests that make no trace: health checks, the version, the live event stream (open for hours; counted by
 * `http.server.active_streams` instead), the web app's chain reads (`/api/rpc`), the telemetry the web app sends
 * through the server (`/api/sync/*`), and preflights.
 */
export const isUntraced = (request: HttpServerRequest.HttpServerRequest) => {
  if (request.method === "OPTIONS") return true
  const path = pathOf(request.url)
  return UNTRACED.has(path) || path.startsWith("/api/sync/")
}
