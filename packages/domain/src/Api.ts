/**
 * bluechip's HTTP API: every group, served under `/api`.
 *
 * @since 0.0.0
 */
import * as HttpApi from "effect/http-api/HttpApi"
import * as OpenApi from "effect/http-api/OpenApi"
import { AccountApi } from "./api/AccountApi.ts"
import { AuthApi } from "./api/AuthApi.ts"
import { EventsApi } from "./api/EventsApi.ts"
import { MarketApi } from "./api/MarketApi.ts"
import { SystemApi } from "./api/SystemApi.ts"
import { ContractCheck, DefectReporting } from "./Contract.ts"

/**
 * The contract shared by the server (handlers) and the web app (typed client). Groups are added by the feature that
 * needs them; the middleware applies to every group added before it.
 *
 * @stability unstable
 * @category api
 * @since 0.0.0
 */
export class BluechipApi extends HttpApi.make("bluechip")
  .add(SystemApi)
  .add(EventsApi)
  .add(AuthApi)
  .add(AccountApi)
  .add(MarketApi)
  .middleware(DefectReporting)
  .middleware(ContractCheck)
  .prefix("/api")
  .annotateMerge(OpenApi.annotations({ title: "bluechip API", version: "0.0.0" }))
{}
