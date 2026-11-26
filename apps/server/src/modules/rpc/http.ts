import { BluechipApi } from "@bluechip/domain/Api"
import { RpcBodyLimit } from "@bluechip/domain/api/RpcApi"
import { CurrentUser } from "@bluechip/domain/Auth"
import { MAX_BODY_BYTES, rpcError } from "@bluechip/domain/rpc/JsonRpc"
import * as ByteSize from "effect/ByteSize"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { RpcProxy } from "./RpcProxy.ts"

// The address a request came from: the proxy's first hop when behind one, else the socket's.
const addressOf = (request: HttpServerRequest.HttpServerRequest) =>
  request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    Option.getOrElse(request.remoteAddress, () => "unknown")

export const RpcBodyLimitLive = Layer.succeed(
  RpcBodyLimit,
  (httpEffect) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const length = Number(request.headers["content-length"] ?? "0")
      if (!Number.isFinite(length) || length > MAX_BODY_BYTES) {
        return HttpServerResponse.jsonUnsafe(rpcError(null, -32600, "The request is too large."), { status: 413 })
      }
      // A body sent without its length is cut off at the limit while it is read.
      return yield* httpEffect.pipe(
        Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(MAX_BODY_BYTES))
      )
    })
)

export const RpcHandlers = HttpApiBuilder.group(
  BluechipApi,
  "rpc",
  Effect.fn(function*(handlers) {
    const proxy = yield* RpcProxy

    return handlers.handleAll({
      call: Effect.fn(function*({ payload }) {
        const user = yield* CurrentUser
        const request = yield* HttpServerRequest.HttpServerRequest
        return yield* proxy.call(payload, { session: user.session, address: addressOf(request) })
      })
    })
  })
)
