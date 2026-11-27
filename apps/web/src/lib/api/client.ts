import { BluechipApi } from "@bluechip/domain/Api"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import * as Effect from "effect/Effect"
import { flow } from "effect/Function"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi"
import * as Reactivity from "effect/reactivity/Reactivity"
import { replaySessionId, track } from "../analytics.ts"
import { apiOrigin } from "./origin.ts"
import { sessionAfter } from "./session.ts"

/** The header that names the session replay a request comes from, so the server's events and spans link to it. */
export const replaySessionHeader = "x-bluechip-replay-session"

// `/api/<group>/…`: the endpoint group, for `api_error`. The live stream's drops are reconnects, not errors.
const reportApiError = (url: string, error: string) => {
  const group = new URL(url).pathname.split("/")[2] ?? "unknown"
  if (group !== "events") track({ _tag: "api_error", endpoint_group: group, error })
}

let sessionLive = false

// A session that ended while the app was open (another device signed it out, or it expired) reads the account
// again, once: its 401 is what the signed-in frame shows, so no screen mistakes it for a connection problem.
const followSession = (status: number, url: string) =>
  Effect.gen(function*() {
    const answer = sessionAfter(sessionLive, status, url)
    sessionLive = answer.live
    if (!answer.ended) return
    const reactivity = yield* Effect.serviceOption(Reactivity.Reactivity)
    if (Option.isSome(reactivity)) reactivity.value.invalidateUnsafe([accountReactivityKey])
  })

/**
 * The typed client for `BluechipApi`, with atoms for queries and mutations. Requests go to the server's origin
 * (`apiOrigin`: its own domain on paper and production, the page's own under Vite's proxy) with the session cookie,
 * the live stream's included. Each carries the replay's session when analytics is on; a server error or a request that never arrived is an `api_error` event
 * (failures the API names are answers, and the server's events count them). A 401 after the account was shown reads
 * the account again, so the signed-in frame says you were signed out.
 */
export class BluechipApiClient extends AtomHttpApi.Service<BluechipApiClient>()("@bluechip/web/BluechipApiClient", {
  api: BluechipApi,
  httpClient: FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" }))
  ),
  baseUrl: apiOrigin === "" ? undefined : apiOrigin,
  transformClient: flow(
    HttpClient.mapRequest((request) => {
      const versioned = HttpClientRequest.setHeader(request, contractVersionHeader, String(ContractVersion))
      const session = replaySessionId()
      return session === null ? versioned : HttpClientRequest.setHeader(versioned, replaySessionHeader, session)
    }),
    HttpClient.tap((response) =>
      Effect.suspend(() => {
        if (response.status >= 500) reportApiError(response.request.url, String(response.status))
        return followSession(response.status, response.request.url)
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
