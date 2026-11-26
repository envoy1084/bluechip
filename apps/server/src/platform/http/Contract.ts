import {
  ContractCheck,
  ContractVersion,
  contractVersionHeader,
  DefectReporting,
  MalformedIds
} from "@bluechip/domain/Contract"
import { ClientOutdated, Internal, NotFound } from "@bluechip/domain/Errors"
import * as Effect from "effect/Effect"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import * as HttpRouter from "effect/http/HttpRouter"
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

// Only path params: a malformed query or body is the caller's mistake (400), a malformed path id names no record.
export const MalformedIdsLive = HttpApiMiddleware.layerSchemaErrorTransform(
  MalformedIds,
  (error) =>
    Effect.gen(function*() {
      if (error.kind !== "Params") return yield* Effect.fail(error)
      const { params } = yield* HttpRouter.RouteContext
      const issue = error.cause.issue
      const pointer = issue._tag === "Pointer" ?
        issue :
        issue._tag === "Composite" ?
        issue.issues.find((child) => child._tag === "Pointer") :
        undefined
      const name = pointer === undefined ? Object.keys(params)[0] : String(pointer.path[0])
      const id = (name === undefined ? undefined : params[name]) ?? ""
      const prefix = id.lastIndexOf("_")
      return yield* new NotFound({ resource: prefix > 0 ? id.slice(0, prefix) : name ?? "resource", id })
    })
)
