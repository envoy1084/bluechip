// Hand-built spans through `BluechipTracer`, recorded as its exporter would get them.
import * as Context from "effect/Context"
import * as Option from "effect/Option"
import * as Tracer from "effect/Tracer"
import * as BluechipTracer from "../../src/platform/telemetry/BluechipTracer.ts"

// Spans are built by hand: a millisecond is 1e6 nanoseconds of start and end time.
export const ms = (n: number) => BigInt(Math.round(n * 1e6))

/**
 * `BluechipTracer` over a tracer that keeps the spans it would export (sampled ones, when they end), with `start` to
 * make spans by hand at time 0 and `names` of what went out.
 */
export const spanRecorder = (options: { readonly sampleReads?: number; readonly random?: number } = {}) => {
  const exported: Array<Tracer.NativeSpan> = []
  const inner = Tracer.make({
    span(spanOptions) {
      const span = new Tracer.NativeSpan(spanOptions)
      const end = span.end.bind(span)
      span.end = (endTime, exit) => {
        end(endTime, exit)
        if (span.sampled) exported.push(span)
      }
      return span
    }
  })
  const tracer = BluechipTracer.make(inner, {
    sampleReads: options.sampleReads ?? 1,
    ticks: new Set(["ScheduleWatcher.runDue"]),
    context: Context.empty(),
    random: () => options.random ?? 0.5
  })
  const start = (
    name: string,
    parent?: Tracer.AnySpan,
    kind: Tracer.SpanKind = "internal",
    attributes: Record<string, unknown> = {}
  ) => {
    const span = tracer.span({
      name,
      parent: Option.fromUndefinedOr(parent),
      annotations: Context.empty(),
      links: [],
      startTime: ms(0),
      kind,
      root: parent === undefined,
      sampled: parent?.sampled ?? true
    })
    for (const [key, value] of Object.entries(attributes)) span.attribute(key, value)
    return span
  }
  const names = () => exported.map((span) => span.name)
  return { exported, start, names }
}
