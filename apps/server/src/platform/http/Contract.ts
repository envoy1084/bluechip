import { ContractCheck, ContractVersion, contractVersionHeader, DefectReporting } from "@bluechip/domain/Contract"
import { ClientOutdated, Internal } from "@bluechip/domain/Errors"
import * as Effect from "effect/Effect"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as Layer from "effect/Layer"

export const ContractCheckLive = Layer.succeed(
  ContractCheck,
  (httpEffect) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const clientVersion = request.headers[contractVersionHeader]
      if (clientVersion !== undefined && clientVersion !== String(ContractVersion)) {
        return yield* new ClientOutdated({ serverVersion: ContractVersion })
      }
      return yield* httpEffect
    })
)

export const DefectReportingLive = Layer.succeed(
  DefectReporting,
  (httpEffect) =>
    httpEffect.pipe(
      Effect.catchDefect((defect) =>
        Effect.gen(function*() {
          const request = yield* HttpServerRequest.HttpServerRequest
          yield* Effect.logError("Unexpected failure", defect)
          return yield* new Internal({ requestId: request.headers["x-request-id"] ?? "unknown" })
        })
      )
    )
)
