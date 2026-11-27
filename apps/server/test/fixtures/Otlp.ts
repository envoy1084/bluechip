// OTLP export requests as the web app sends them.
import type { TraceData } from "effect/observability/OtlpTracer"

/** A traces export request of one span, its resource carrying `attributes`. */
export const trace = (attributes: TraceData["resourceSpans"][number]["resource"]["attributes"]): TraceData => ({
  resourceSpans: [{
    resource: { attributes, droppedAttributesCount: 0 },
    scopeSpans: [{
      scope: { name: "bluechip-web" },
      spans: [{
        traceId: "a".repeat(32),
        spanId: "b".repeat(16),
        parentSpanId: undefined,
        name: "GET /home",
        kind: 2,
        startTimeUnixNano: "1",
        endTimeUnixNano: "2",
        attributes: [],
        droppedAttributesCount: 0,
        events: [],
        droppedEventsCount: 0,
        status: { code: 0 },
        links: [],
        droppedLinksCount: 0
      }]
    }]
  }]
} as unknown as TraceData)
