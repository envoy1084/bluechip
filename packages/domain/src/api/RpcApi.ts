/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { JsonRpcRequest, JsonRpcResponse } from "../rpc/JsonRpc.ts"

/**
 * Refuses a request body over `MAX_BODY_BYTES` before it is read, with a JSON-RPC error (413).
 *
 * @stability unstable
 * @category middleware
 * @since 0.0.0
 */
export class RpcBodyLimit
  extends HttpApiMiddleware.Service<RpcBodyLimit>()("@bluechip/domain/api/RpcApi/RpcBodyLimit")
{}

/**
 * The chain's JSON-RPC for the signed-in web app (its wallet code), forwarded by the server to its own node: one call
 * or a batch of up to `MAX_BATCH`, reads only. A call bluechip doesn't forward, a batch over the cap, or too many
 * requests from one session or address answer JSON-RPC errors.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class RpcApi extends HttpApiGroup.make("rpc").add(
  HttpApiEndpoint.post("call", "/rpc", {
    payload: Schema.Union([JsonRpcRequest, Schema.Array(JsonRpcRequest)]),
    success: Schema.Union([JsonRpcResponse, Schema.Array(JsonRpcResponse)])
  })
).middleware(RpcBodyLimit).middleware(Authentication) {}
