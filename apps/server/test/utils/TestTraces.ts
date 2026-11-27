// The server's spans in memory: every span made under `BluechipTracer` (before trimming) and those it lets out
// (after), so a test reads a flow's trace as Axiom would get it.
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpMiddleware from "effect/http/HttpMiddleware"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Tracer from "effect/Tracer"
import * as BluechipTracer from "../../src/platform/telemetry/BluechipTracer.ts"
import { isUntraced, spanNameOf } from "../../src/platform/telemetry/SpanNames.ts"
import { TICKS } from "../../src/platform/telemetry/Telemetry.ts"

/** An exported span, as the test reads it. */
interface RecordedSpan {
  readonly name: string
  readonly kind: Tracer.SpanKind
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId: string | undefined
  readonly attributes: ReadonlyMap<string, unknown>
  readonly durationMs: number
}

export class TestTraces extends Context.Service<TestTraces, {
  /** The spans of `traceId` the tracer exported, in the order they ended. */
  readonly exported: (traceId: string) => ReadonlyArray<RecordedSpan>
  /** How many spans of `traceId` were made, kept or not. */
  readonly made: (traceId: string) => number
  /** The server span of the request to `route` that `userId` made last. */
  readonly request: (route: string, userId: string) => Effect.Effect<RecordedSpan>
  /**
   * The SQL spans of `traceId` that trimming should have dropped or named: `BEGIN`, `COMMIT`, a statement named for
   * the database, or one under 2 ms that worked with no children.
   */
  readonly noise: (traceId: string) => ReadonlyArray<string>
}>()("@bluechip/server/test/TestTraces") {
  /** The tracer (every read sampled) and the server's span names, with the spans recorded. */
  static readonly layer = Layer.unwrap(Effect.gen(function*() {
    const exported: Array<RecordedSpan> = []
    const made: Array<Tracer.Span> = []
    const recorder = Tracer.make({
      span(options) {
        const span = new Tracer.NativeSpan(options)
        const end = span.end.bind(span)
        span.end = (endTime, exit) => {
          end(endTime, exit)
          if (!span.sampled) return
          exported.push({
            name: span.name,
            kind: span.kind,
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: Option.getOrUndefined(span.parent)?.spanId,
            attributes: span.attributes,
            durationMs: Number(endTime - options.startTime) / 1e6
          })
        }
        return span
      }
    })
    const trimmed = BluechipTracer.make(recorder, {
      sampleReads: 1,
      ticks: TICKS,
      context: yield* Effect.context<never>()
    })
    const counting = Tracer.make({
      span(options) {
        const span = trimmed.span(options)
        made.push(span)
        return span
      }
    })
    return Layer.mergeAll(
      Layer.succeed(TestTraces, {
        exported: (traceId) => exported.filter((span) => span.traceId === traceId),
        made: (traceId) => made.filter((span) => span.traceId === traceId).length,
        request: (route, userId) =>
          Effect.sync(() =>
            exported.findLast((span) => span.name === route && span.attributes.get("user.id") === userId)
          ).pipe(Effect.flatMap(Effect.fromNullishOr), Effect.orDie),
        noise: (traceId) =>
          exported.filter((span) =>
            span.traceId === traceId && (
              /^(BEGIN|COMMIT)\b/.test(span.name) ||
              (span.attributes.has("db.query.text") &&
                (!/^(select|insert|update|delete|other) /.test(span.name) || span.durationMs < 2))
            )
          ).map((span) => span.name)
      }),
      Layer.succeed(Tracer.Tracer, counting),
      Layer.succeed(HttpMiddleware.SpanNameGenerator)(spanNameOf),
      Layer.succeed(HttpMiddleware.TracerDisabledWhen)(isUntraced)
    )
  }))
}
