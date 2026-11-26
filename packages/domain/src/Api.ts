/**
 * bluechip's HTTP API: every group, served under `/api`.
 *
 * @since 0.0.0
 */
import * as HttpApi from "effect/http-api/HttpApi"
import * as OpenApi from "effect/http-api/OpenApi"
import { AccountApi } from "./api/AccountApi.ts"
import { ActivityApi } from "./api/ActivityApi.ts"
import { AgentsApi } from "./api/AgentsApi.ts"
import { AssistantApi } from "./api/AssistantApi.ts"
import { AuthApi } from "./api/AuthApi.ts"
import { AutomationsApi } from "./api/AutomationsApi.ts"
import { ChannelsApi } from "./api/ChannelsApi.ts"
import { DevApi } from "./api/DevApi.ts"
import { EventsApi } from "./api/EventsApi.ts"
import { IntentsApi } from "./api/IntentsApi.ts"
import { MarketApi } from "./api/MarketApi.ts"
import { NotificationsApi } from "./api/NotificationsApi.ts"
import { PoliciesApi } from "./api/PoliciesApi.ts"
import { PortfolioApi } from "./api/PortfolioApi.ts"
import { PushApi } from "./api/PushApi.ts"
import { SystemApi } from "./api/SystemApi.ts"
import { TradesApi } from "./api/TradesApi.ts"
import { TransfersApi } from "./api/TransfersApi.ts"
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
  .add(PortfolioApi)
  .add(TransfersApi)
  .add(TradesApi)
  .add(PoliciesApi)
  .add(AgentsApi)
  .add(IntentsApi)
  .add(AutomationsApi)
  .add(ActivityApi)
  .add(AssistantApi)
  .add(NotificationsApi)
  .add(PushApi)
  .add(ChannelsApi)
  .add(DevApi)
  .middleware(DefectReporting)
  .middleware(ContractCheck)
  .prefix("/api")
  .annotateMerge(OpenApi.annotations({ title: "bluechip API", version: "0.0.0" }))
{}
