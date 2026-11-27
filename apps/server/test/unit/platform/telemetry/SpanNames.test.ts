import { assert, describe, it } from "@effect/vitest"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import { isUntraced, routeOf } from "../../../../src/platform/telemetry/SpanNames.ts"

describe("routeOf", () => {
  it.each([
    ["POST", "/api/trades/signing_01/confirm", "/api/trades/:id/confirm"],
    ["GET", "/api/portfolio?range=1d", "/api/portfolio"],
    ["POST", "/api/intents", "/api/intents"],
    ["GET", "/health", "/health"],
    ["GET", "/nowhere", "*"],
    ["DELETE", "/api/portfolio", "*"]
  ])("%s %s", (method, url, expected) => {
    assert.strictEqual(routeOf(method, url), expected)
  })
})

describe("isUntraced", () => {
  it.each([
    ["GET", "/health", true],
    ["GET", "/api/version", true],
    ["GET", "/api/events", true],
    ["POST", "/api/rpc", true],
    ["POST", "/api/sync/t", true],
    ["OPTIONS", "/api/intents", true],
    ["POST", "/api/intents", false],
    ["GET", "/api/portfolio", false]
  ])("%s %s", (method, url, expected) => {
    const request = HttpServerRequest.fromWeb(new Request(`http://bluechip${url}`, { method }))
    assert.strictEqual(isUntraced(request), expected)
  })
})
