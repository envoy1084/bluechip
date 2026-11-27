import { BluechipApi } from "@bluechip/domain/Api"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import * as Effect from "effect/Effect"
import { flow } from "effect/Function"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi"
import { replaySessionId, track } from "../analytics.ts"

/** The header that names the session replay a request comes from, so the server's events and spans link to it. */
export const replaySessionHeader = "x-bluechip-replay-session"

// `/api/<group>/…`: the endpoint group, for `api_error`. The live stream's drops are reconnects, not errors.
const reportApiError = (url: string, error: string) => {
  const group = new URL(url).pathname.split("/")[2] ?? "unknown"
  if (group !== "events") track({ _tag: "api_error", endpoint_group: group, error })
}

/**
 * The typed client for `BluechipApi`, with atoms for queries and mutations. Requests go to `/api` on the page's own
 * origin (Vite proxies it in development), so the session cookie is first-party and there is no CORS. Each carries the
 * replay's session when analytics is on; a server error or a request that never arrived is an `api_error` event
 * (failures the API names are answers, and the server's events count them).
 */
export class BluechipApiClient extends AtomHttpApi.Service<BluechipApiClient>()("@bluechip/web/BluechipApiClient", {
  api: BluechipApi,
  httpClient: FetchHttpClient.layer,
  transformClient: flow(
    HttpClient.mapRequest((request) => {
      const versioned = HttpClientRequest.setHeader(request, contractVersionHeader, String(ContractVersion))
      const session = replaySessionId()
      return session === null ? versioned : HttpClientRequest.setHeader(versioned, replaySessionHeader, session)
    }),
    HttpClient.tap((response) =>
      Effect.sync(() => {
        if (response.status >= 500) reportApiError(response.request.url, String(response.status))
      })
    ),
    HttpClient.tapError((error) => Effect.sync(() => reportApiError(error.request.url, error.reason._tag)))
  )
}) {}

/** Queries about the signed-in user refetch when this key is invalidated (sign-in, sign-out, eligibility). */
export const accountReactivityKey = "account"

/** Queries tagged with this key refetch after the live stream reconnects, so missed events never leave stale data. */
export const liveReactivityKey = "live"

/** The user's portfolio and withdrawals refetch when this key is invalidated (live `PortfolioChanged` events). */
export const portfolioReactivityKey = "portfolio"

/** The user's agents refetch when this key is invalidated (live `AgentChanged` events). */
export const agentsReactivityKey = "agents"

/** Saved templates refetch when this key is invalidated (after saving or deleting one). */
export const templatesReactivityKey = "templates"

/** Intents and approvals refetch when this key is invalidated (live `IntentChanged` events). */
export const intentsReactivityKey = "intents"

/** Agents' usage refetches when this key is invalidated (an agent's trade filled). */
export const usageReactivityKey = "usage"

/** Automations and their runs refetch when this key is invalidated (after saving, pausing or deleting one). */
export const automationsReactivityKey = "automations"

/** Notifications and their unread count refetch when this key is invalidated (live `NotificationAdded` events). */
export const notificationsReactivityKey = "notifications"

/** Linked chats refetch when this key is invalidated (a chat linked or unlinked, from either side). */
export const channelsReactivityKey = "channels"

/** Passkeys, devices and the recovery refetch when this key is invalidated (live `AccountChanged` events). */
export const securityReactivityKey = "security"
