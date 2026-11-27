/**
 * How calls to the chain and the bundler show in traces and metrics: a `client` span per call, and its latency and
 * failures counted by operation (never by account or operation hash, which stay on the span).
 *
 * @since 0.0.0
 */
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Metric from "effect/Metric"
import { ChainError } from "./ChainError.ts"
import type { Network } from "./Network.ts"

/**
 * The latency of each chain call (`ChainClient.use`), by operation and outcome (`ok`, `error`).
 *
 * @stability unstable
 * @category metrics
 * @since 0.0.0
 */
export const ChainRpcDuration = Metric.histogram("bluechip.chain.rpc.duration", {
  description: "Chain call latency",
  attributes: { unit: "ms" },
  boundaries: [10, 25, 50, 100, 250, 500, 1_000, 5_000]
})

/**
 * Chain calls that failed, by operation and kind (`timeout`, `rate_limited`, `reverted`, `other`).
 *
 * @stability unstable
 * @category metrics
 * @since 0.0.0
 */
export const ChainRpcErrors = Metric.counter("bluechip.chain.rpc.errors", {
  description: "Chain calls that failed",
  attributes: { unit: "{error}" },
  incremental: true
})

/**
 * Bundler calls, by method, provider (`alto`, `alchemy`), outcome and error code (`AA21`, `-32503`; `none` when it
 * worked).
 *
 * @stability unstable
 * @category metrics
 * @since 0.0.0
 */
export const BundlerCalls = Metric.counter("bluechip.bundler.calls", {
  description: "Bundler calls",
  attributes: { unit: "{call}" },
  incremental: true
})

/**
 * The latency of each bundler call, by method and provider.
 *
 * @stability unstable
 * @category metrics
 * @since 0.0.0
 */
export const BundlerDuration = Metric.histogram("bluechip.bundler.duration", {
  description: "Bundler call latency",
  attributes: { unit: "ms" },
  boundaries: [10, 25, 50, 100, 250, 500, 1_000, 5_000]
})

/**
 * The chain's metrics and the attributes each is recorded with, for the server's metric catalogue.
 *
 * @stability unstable
 * @category metrics
 * @since 0.0.0
 */
export const chainMetrics: ReadonlyArray<{
  readonly metric: Metric.Metric<number, unknown>
  readonly kind: "counter" | "histogram"
  readonly attributes: ReadonlyArray<string>
}> = [
  { metric: ChainRpcDuration, kind: "histogram", attributes: ["operation", "outcome"] },
  { metric: ChainRpcErrors, kind: "counter", attributes: ["operation", "kind"] },
  { metric: BundlerCalls, kind: "counter", attributes: ["rpc.method", "provider", "outcome", "error_code"] },
  { metric: BundlerDuration, kind: "histogram", attributes: ["rpc.method", "provider"] }
]

// viem wraps the node's answer in layers of errors (`cause`); the innermost names say what happened.
const causes = (cause: unknown): ReadonlyArray<{ readonly name: string; readonly message: string; code?: unknown }> => {
  const found: Array<{ name: string; message: string; code?: unknown }> = []
  for (let error = cause, depth = 0; error instanceof Error && depth < 8; error = error.cause, depth++) {
    found.push(error as Error & { code?: unknown })
  }
  return found
}

/**
 * What kind of failure a chain call met: `timeout`, `rate_limited` (HTTP 429 or the node's limit), `reverted` or
 * `other`.
 *
 * **Example** (A reverted call)
 *
 * ```ts import.meta.vitest
 * import { errorKind } from "@bluechip/chain/ChainTelemetry"
 *
 * errorKind(new Error("call failed", { cause: Object.assign(new Error("execution reverted"), { name: "ExecutionRevertedError" }) }))
 * // "reverted"
 * ```
 *
 * @stability unstable
 * @category telemetry
 * @since 0.0.0
 */
export const errorKind = (cause: unknown): "timeout" | "rate_limited" | "reverted" | "other" => {
  const chain = causes(cause)
  if (chain.some((error) => /Timeout/i.test(error.name))) return "timeout"
  if (chain.some((error) => /LimitExceeded|RateLimit/i.test(error.name) || /\b429\b|rate limit/i.test(error.message))) {
    return "rate_limited"
  }
  if (chain.some((error) => /Revert/i.test(error.name) || /execution reverted/i.test(error.message))) return "reverted"
  return "other"
}

/**
 * The bundler's error code for a failed call: the EntryPoint's `AAxx` when it gave one, else the JSON-RPC code, else
 * `unknown`.
 *
 * **Example** (A prefund the account can't pay)
 *
 * ```ts import.meta.vitest
 * import { bundlerErrorCode } from "@bluechip/chain/ChainTelemetry"
 *
 * bundlerErrorCode(new Error("UserOperation reverted during simulation with reason: AA21 didn't pay prefund"))
 * // "AA21"
 * ```
 *
 * @stability unstable
 * @category telemetry
 * @since 0.0.0
 */
export const bundlerErrorCode = (cause: unknown): string => {
  const chain = causes(cause)
  for (const error of chain) {
    const aa = /\bAA\d\d\b/.exec(error.message)
    if (aa !== null) return aa[0]
  }
  const coded = chain.find((error) => typeof error.code === "number")
  return coded === undefined ? "unknown" : String(coded.code)
}

/**
 * A chain read or write in a `chain.<operation>` client span, measured into {@link ChainRpcDuration} and
 * {@link ChainRpcErrors}.
 *
 * @stability unstable
 * @category telemetry
 * @since 0.0.0
 */
export const traceChain = (network: Network, operation: string) =>
<A, R>(
  self: Effect.Effect<A, ChainError, R>
): Effect.Effect<A, ChainError, R> =>
  Effect.gen(function*() {
    const [took, exit] = yield* Effect.timed(Effect.exit(self))
    yield* Metric.update(
      Metric.withAttributes(ChainRpcDuration, { operation, outcome: Exit.isSuccess(exit) ? "ok" : "error" }),
      Duration.toMillis(took)
    )
    if (Exit.isFailure(exit)) {
      const failure = exit.cause.reasons.find((reason) => reason._tag === "Fail")
      const kind = failure?._tag === "Fail" ? errorKind(failure.error.cause) : "other"
      yield* Effect.annotateCurrentSpan("chain.error_kind", kind)
      yield* Metric.update(Metric.withAttributes(ChainRpcErrors, { operation, kind }), 1)
    }
    return yield* exit
  }).pipe(
    Effect.withSpan(`chain.${operation}`, { kind: "client", attributes: { "rpc.system": "jsonrpc", network } })
  )

/**
 * Calls the bundler (`f`, a viem bundler client call) in a `bundler.<method>` client span with `rpc.method` and, on
 * failure, `bundler.error_code` and `bundler.error`; measured into {@link BundlerCalls} and {@link BundlerDuration}. A
 * failure is a {@link ChainError} for `method`.
 *
 * @stability unstable
 * @category telemetry
 * @since 0.0.0
 */
export const callBundler = <A>(
  method: string,
  provider: string,
  f: () => Promise<A>
): Effect.Effect<A, ChainError> =>
  Effect.gen(function*() {
    const [took, exit] = yield* Effect.timed(Effect.exit(
      Effect.tryPromise({ try: f, catch: (cause) => new ChainError({ operation: method, cause }) })
    ))
    yield* Metric.update(
      Metric.withAttributes(BundlerDuration, { "rpc.method": method, provider }),
      Duration.toMillis(took)
    )
    let errorCode = "none"
    if (Exit.isFailure(exit)) {
      const failure = exit.cause.reasons.find((reason) => reason._tag === "Fail")
      const cause = failure?._tag === "Fail" ? failure.error.cause : undefined
      errorCode = bundlerErrorCode(cause)
      yield* Effect.annotateCurrentSpan({
        "bundler.error_code": errorCode,
        "bundler.error": cause instanceof Error ? cause.message.slice(0, 300) : String(cause)
      })
    }
    yield* Metric.update(
      Metric.withAttributes(BundlerCalls, {
        "rpc.method": method,
        provider,
        outcome: Exit.isSuccess(exit) ? "ok" : "error",
        error_code: errorCode
      }),
      1
    )
    return yield* exit
  }).pipe(
    Effect.withSpan(`bundler.${method}`, {
      kind: "client",
      attributes: { "rpc.system": "jsonrpc", "rpc.method": method, "bundler.provider": provider }
    })
  )
