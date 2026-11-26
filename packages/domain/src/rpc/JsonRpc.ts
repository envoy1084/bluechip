/**
 * The chain's JSON-RPC as the web app reads it, through bluechip's server: which methods it may call (the reads its
 * wallet code makes), how many in one batch, and the JSON-RPC errors for anything else. No RPC key ever reaches a
 * browser: the server forwards to its own node.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

/**
 * The methods the web app calls: wagmi's chain id and block number, and contract reads (`eth_call`), plus a balance.
 * Nothing that sends.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const ALLOWED_METHODS: ReadonlyArray<string> = ["eth_chainId", "eth_blockNumber", "eth_call", "eth_getBalance"]

/**
 * The most requests one batch may hold.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MAX_BATCH = 20

/**
 * The largest request body, in bytes.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MAX_BODY_BYTES = 64 * 1024

/**
 * A JSON-RPC request id: a string, a number, or `null`.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JsonRpcId = Schema.NullOr(Schema.Union([Schema.String, Schema.Number]))

/**
 * One JSON-RPC 2.0 call.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JsonRpcRequest = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  id: JsonRpcId,
  method: Schema.String,
  params: Schema.optionalKey(Schema.Array(Schema.Json))
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type JsonRpcRequest = typeof JsonRpcRequest.Type

/**
 * One JSON-RPC 2.0 answer: a result, or an error.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JsonRpcResponse = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  id: JsonRpcId,
  result: Schema.optionalKey(Schema.Json),
  error: Schema.optionalKey(Schema.Struct({ code: Schema.Number, message: Schema.String }))
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type JsonRpcResponse = typeof JsonRpcResponse.Type

/**
 * A JSON-RPC error answer (`-32601` an unknown or refused method, `-32600` an invalid request, `-32005` over a limit,
 * `-32603` the node didn't answer).
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const rpcError = (id: JsonRpcRequest["id"], code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message }
})

/**
 * The answer for a call bluechip doesn't forward: a method outside {@link ALLOWED_METHODS}. `undefined` for one it
 * forwards.
 *
 * **Example** (Sending is refused)
 *
 * ```ts import.meta.vitest
 * import { refusal } from "@bluechip/domain/rpc/JsonRpc"
 *
 * refusal({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction" })?.error?.code // => -32601
 * refusal({ jsonrpc: "2.0", id: 1, method: "eth_chainId" }) // => undefined
 * ```
 *
 * @stability unstable
 * @category rules
 * @since 0.0.0
 */
export const refusal = (request: JsonRpcRequest): JsonRpcResponse | undefined =>
  ALLOWED_METHODS.includes(request.method) ?
    undefined :
    rpcError(request.id, -32601, `bluechip doesn't forward ${request.method}`)
