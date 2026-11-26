import { BluechipApi } from "@bluechip/domain/Api"
import { ContractVersion, contractVersionHeader } from "@bluechip/domain/Contract"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi"

/**
 * The typed client for `BluechipApi`, with atoms for queries and mutations. Requests go to `/api` on the page's own
 * origin (Vite proxies it in development), so the session cookie is first-party and there is no CORS.
 */
export class BluechipApiClient extends AtomHttpApi.Service<BluechipApiClient>()("@bluechip/web/BluechipApiClient", {
  api: BluechipApi,
  httpClient: FetchHttpClient.layer,
  transformClient: HttpClient.mapRequest(HttpClientRequest.setHeader(contractVersionHeader, String(ContractVersion)))
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
