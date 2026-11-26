import { BluechipApi } from "@bluechip/domain/Api"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpApiScalar from "effect/http-api/HttpApiScalar"
import * as Layer from "effect/Layer"
import { AccountHandlers } from "./modules/accounts/http.ts"
import { ActivityHandlers } from "./modules/activity/http.ts"
import { AgentsHandlers } from "./modules/agents/http.ts"
import { AssistantHandlers } from "./modules/assistant/http.ts"
import { AuthenticationLive } from "./modules/auth/Authentication.ts"
import { AuthHandlers } from "./modules/auth/http.ts"
import { AutomationsHandlers } from "./modules/automations/http.ts"
import { DevHandlers } from "./modules/dev/http.ts"
import { EventsHandlers } from "./modules/events/http.ts"
import { TransfersHandlers } from "./modules/funding/http.ts"
import { IntentsHandlers } from "./modules/intents/http.ts"
import { MarketHandlers } from "./modules/market/http.ts"
import { PoliciesHandlers } from "./modules/policies/http.ts"
import { PortfolioHandlers } from "./modules/portfolio/http.ts"
import { SystemHandlers } from "./modules/system/http.ts"
import { TradesHandlers } from "./modules/trading/http.ts"
import { ContractCheckLive, DefectReportingLive } from "./platform/http/Contract.ts"

/** Every group's handlers with the contract middleware; tests serve these in memory. */
export const ApiHandlers = Layer.mergeAll(
  SystemHandlers,
  EventsHandlers,
  AuthHandlers,
  AccountHandlers,
  MarketHandlers,
  PortfolioHandlers,
  TransfersHandlers,
  TradesHandlers,
  PoliciesHandlers,
  AgentsHandlers,
  IntentsHandlers,
  AutomationsHandlers,
  ActivityHandlers,
  AssistantHandlers,
  DevHandlers
)
  .pipe(
    Layer.provideMerge(Layer.mergeAll(ContractCheckLive, DefectReportingLive, AuthenticationLive))
  )

/** `/api/*`, the OpenAPI document at `/api/openapi.json` and its docs page at `/api/docs`. */
export const ApiRoutes = Layer.mergeAll(
  HttpApiBuilder.layer(BluechipApi, { openapiPath: "/api/openapi.json" }),
  HttpApiScalar.layer(BluechipApi, { path: "/api/docs" })
).pipe(Layer.provide(ApiHandlers))
