import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type * as HttpBody from "effect/http/HttpBody"
import * as OtlpSerialization from "effect/observability/OtlpSerialization"
import type { TraceData } from "effect/observability/OtlpTracer"
import { stampJson, stampProtobuf } from "../../../../src/platform/telemetry/OtlpStamp.ts"
import { trace } from "../../../fixtures/Otlp.ts"

const STAMPS = { "deployment.environment": "paper", network: "sepolia" }

const service = { key: "service.name", value: { stringValue: "bluechip-web" } }

describe("stampJson", () => {
  it("adds the deployment and network to a resource without them", () => {
    const stamped = JSON.parse(stampJson(JSON.stringify(trace([service])), STAMPS))

    assert.deepStrictEqual(stamped.resourceSpans[0].resource.attributes, [
      service,
      { key: "deployment.environment", value: { stringValue: "paper" } },
      { key: "network", value: { stringValue: "sepolia" } }
    ])
  })

  it("keeps what the browser said", () => {
    const own = { key: "deployment.environment", value: { stringValue: "production" } }
    const stamped = JSON.parse(stampJson(JSON.stringify(trace([own])), STAMPS))

    assert.deepStrictEqual(stamped.resourceSpans[0].resource.attributes, [
      own,
      { key: "network", value: { stringValue: "sepolia" } }
    ])
  })

  it("gives a resource to logs without one", () => {
    const stamped = JSON.parse(stampJson(JSON.stringify({ resourceLogs: [{ scopeLogs: [] }] }), STAMPS))

    assert.deepStrictEqual(stamped.resourceLogs[0].resource.attributes.map((each: { key: string }) => each.key), [
      "deployment.environment",
      "network"
    ])
  })
})

describe("stampProtobuf", () => {
  it.effect("is the request with the stamps encoded as the resource's last attributes", () =>
    Effect.gen(function*() {
      const serialization = yield* OtlpSerialization.OtlpSerialization
      const bytes = (data: TraceData) => (serialization.traces(data) as HttpBody.Uint8Array).body

      const stamped = stampProtobuf(bytes(trace([service])), STAMPS)

      assert.deepStrictEqual(
        stamped,
        bytes(trace([
          service,
          { key: "deployment.environment", value: { stringValue: "paper" } },
          { key: "network", value: { stringValue: "sepolia" } }
        ]))
      )
    }).pipe(Effect.provide(OtlpSerialization.layerProtobuf)))

  it.effect("leaves a resource that has them as it was", () =>
    Effect.gen(function*() {
      const serialization = yield* OtlpSerialization.OtlpSerialization
      const full = (serialization.traces(trace([
        { key: "deployment.environment", value: { stringValue: "production" } },
        { key: "network", value: { stringValue: "base" } }
      ])) as HttpBody.Uint8Array).body

      assert.deepStrictEqual(stampProtobuf(full, STAMPS), full)
    }).pipe(Effect.provide(OtlpSerialization.layerProtobuf)))

  it("throws on a body that isn't protobuf", () => {
    assert.throws(() => stampProtobuf(new Uint8Array([0x0a, 0xff]), STAMPS))
  })
})
