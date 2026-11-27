import { type JsonRpcRequest, JsonRpcResponse, MAX_BATCH, refusal, rpcError } from "@bluechip/domain/rpc/JsonRpc"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as RateLimiter from "effect/persistence/RateLimiter"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { count, RpcProxyCalls } from "../../platform/telemetry/Metrics.ts"

/** Who is calling, for the rate limits: their session and their address on the network. */
export interface RpcCaller {
  readonly session: string
  readonly address: string
}

// Calls a minute: per session, and per address (a household or an office shares one).
const PER_SESSION = 120
const PER_ADDRESS = 300

const Upstream = Schema.Union([JsonRpcResponse, Schema.Array(JsonRpcResponse)])

/**
 * The chain's JSON-RPC for the web app, forwarded to the server's own node (`BASE_RPC_URL`, its key never leaves the
 * server): the methods the web reads with, in one call or a batch of up to `MAX_BATCH`, within a rate per session and
 * per address. Anything else is answered with a JSON-RPC error, and no answer ever names the node.
 */
export class RpcProxy extends Context.Service<RpcProxy, {
  readonly call: (
    payload: JsonRpcRequest | ReadonlyArray<JsonRpcRequest>,
    caller: RpcCaller
  ) => Effect.Effect<JsonRpcResponse | ReadonlyArray<JsonRpcResponse>>
}>()("@bluechip/server/RpcProxy") {
  static readonly layer = Layer.effect(
    RpcProxy,
    Effect.gen(function*() {
      const url = yield* Config.Redacted("BASE_RPC_URL").pipe(
        Config.withDefault(Redacted.make("http://localhost:8545")),
        Effect.orDie
      )
      const http = yield* HttpClient.HttpClient
      const limiter = yield* RateLimiter.RateLimiter
      const node = Redacted.value(url)

      const within = (caller: RpcCaller, tokens: number) =>
        Effect.all([
          limiter.consume({ key: `rpc:session:${caller.session}`, limit: PER_SESSION, window: "1 minute", tokens }),
          limiter.consume({ key: `rpc:address:${caller.address}`, limit: PER_ADDRESS, window: "1 minute", tokens })
        ], { discard: true }).pipe(
          Effect.match({ onFailure: () => false, onSuccess: () => true })
        )

      // The node's answers to `requests`, by their position: each sent under its index as id, so answers in any order
      // (or with the caller's ids repeated) find their request. A node that doesn't answer is said without naming it.
      const forward = Effect.fnUntraced(function*(requests: ReadonlyArray<JsonRpcRequest>) {
        const sent = requests.map((request, index) => ({ ...request, id: index }))
        const answers = yield* http.execute(HttpClientRequest.post(node).pipe(HttpClientRequest.bodyJsonUnsafe(sent)))
          .pipe(
            Effect.flatMap((response) => response.json),
            Effect.flatMap(Schema.decodeUnknownEffect(Upstream)),
            Effect.map((decoded) => Array.isArray(decoded) ? decoded : [decoded]),
            Effect.orElseSucceed(() => [] as ReadonlyArray<JsonRpcResponse>)
          )
        return requests.map((request, index) => {
          const answer = answers.find((each) => each.id === index)
          if (answer === undefined) return rpcError(request.id, -32603, "Base didn't answer. Try again in a moment.")
          return answer.error === undefined ?
            { ...answer, id: request.id } :
            rpcError(request.id, answer.error.code, answer.error.message.replaceAll(node, "the node"))
        })
      })

      // Refused methods are anyone's strings: counted together, so the metric keeps a series per method served.
      const countCall = (request: JsonRpcRequest, outcome: string) =>
        count(RpcProxyCalls, { "rpc.method": outcome === "refused" ? "other" : request.method, outcome })

      const call = Effect.fn("RpcProxy.call")(function*(
        payload: JsonRpcRequest | ReadonlyArray<JsonRpcRequest>,
        caller: RpcCaller
      ) {
        const batch = Array.isArray(payload)
        const requests: ReadonlyArray<JsonRpcRequest> = Array.isArray(payload) ? payload : [payload as JsonRpcRequest]
        if (requests.length === 0 || requests.length > MAX_BATCH) {
          return rpcError(null, -32600, `A batch holds 1 to ${MAX_BATCH} calls.`)
        }
        if (!(yield* within(caller, requests.length))) {
          for (const request of requests) yield* countCall(request, "rate_limited")
          const refused = requests.map((request) =>
            rpcError(request.id, -32005, "Too many calls. Try again in a minute.")
          )
          return batch ? refused : refused[0]!
        }

        const forwarded = requests.filter((request) => refusal(request) === undefined)
        const answers = forwarded.length === 0 ? [] : yield* forward(forwarded)
        const answered = requests.map((request) => refusal(request) ?? answers[forwarded.indexOf(request)]!)
        for (const [index, request] of requests.entries()) {
          const answer = answered[index]!
          yield* countCall(
            request,
            refusal(request) !== undefined ? "refused" : answer.error?.code === -32603 ? "upstream_error" : "ok"
          )
        }
        return batch ? answered : answered[0]!
      })

      return RpcProxy.of({ call })
    })
  ).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RateLimiter.layer),
    Layer.provide(RateLimiter.layerStoreMemory)
  )
}
