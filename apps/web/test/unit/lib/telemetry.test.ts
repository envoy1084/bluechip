import { assert, describe, it } from "@effect/vitest"
import { requestSpanName, sessionSampled, untracedRequest } from "../../../src/lib/telemetry.ts"

describe("sessionSampled", () => {
  it.each([
    { name: "a session already kept", stored: "1", roll: 0.99, expected: true },
    { name: "a session already left out", stored: "0", roll: 0, expected: false },
    { name: "a new session just under the rate", stored: null, roll: 0.19, expected: true },
    { name: "a new session on the rate", stored: null, roll: 0.2, expected: false },
    { name: "a new session over the rate", stored: null, roll: 0.5, expected: false },
    { name: "a stored value that means nothing", stored: "yes", roll: 0.9, expected: false }
  ])("$name", ({ stored, roll, expected }) => {
    assert.strictEqual(sessionSampled(stored, roll), expected)
  })
})

describe("untracedRequest", () => {
  it.each([
    { name: "an API call", path: "/api/trades", expected: false },
    { name: "the live stream", path: "/api/events", expected: true },
    { name: "telemetry's own export", path: "/api/telemetry/v1/traces", expected: true },
    { name: "analytics' own requests", path: "/ingest/e/", expected: true },
    { name: "a path that only starts like the stream", path: "/api/eventsx", expected: false }
  ])("$name", ({ path, expected }) => {
    assert.strictEqual(untracedRequest(path), expected)
  })
})

describe("requestSpanName", () => {
  it("names a request by its route", () => {
    assert.strictEqual(
      requestSpanName("POST", "/api/trades/trade_01jdxk4m2v8y9q5t3n7r6w0zab/confirm"),
      "POST /api/trades/:id/confirm"
    )
  })
})
