import { BluechipApi } from "@bluechip/domain/Api"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpApiScalar from "effect/http-api/HttpApiScalar"
import * as Layer from "effect/Layer"
import { ContractCheckLive, DefectReportingLive } from "./Contract.ts"
import { EventsHandlers } from "./Events.ts"
import { SystemHandlers } from "./System.ts"

/** Every group's handlers with the contract middleware; tests serve these in memory. */
export const ApiHandlers = Layer.mergeAll(SystemHandlers, EventsHandlers).pipe(
  Layer.provideMerge(Layer.mergeAll(ContractCheckLive, DefectReportingLive))
)

/** `/api/*`, the OpenAPI document at `/api/openapi.json` and its docs page at `/api/docs`. */
export const ApiRoutes = Layer.mergeAll(
  HttpApiBuilder.layer(BluechipApi, { openapiPath: "/api/openapi.json" }),
  HttpApiScalar.layer(BluechipApi, { path: "/api/docs" })
).pipe(Layer.provide(ApiHandlers))
