import { BluechipApi } from "@bluechip/domain/Api"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpApiScalar from "effect/http-api/HttpApiScalar"
import * as Layer from "effect/Layer"
import { AuthenticationLive } from "../auth/Authentication.ts"
import { AccountHandlers } from "./Account.ts"
import { ActivityHandlers } from "./Activity.ts"
import { AgentsHandlers } from "./Agents.ts"
import { AuthHandlers } from "./Auth.ts"
import { ContractCheckLive, DefectReportingLive } from "./Contract.ts"
import { DevHandlers } from "./Dev.ts"
import { EventsHandlers } from "./Events.ts"
import { MarketHandlers } from "./Market.ts"
import { PortfolioHandlers } from "./Portfolio.ts"
import { SystemHandlers } from "./System.ts"
import { TradesHandlers } from "./Trades.ts"
import { TransfersHandlers } from "./Transfers.ts"

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
  AgentsHandlers,
  ActivityHandlers,
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
