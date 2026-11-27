import { EVENTS, toCapture } from "@bluechip/domain/analytics/Events"
import { FORBIDDEN_METRIC_ATTRIBUTES, METRICS } from "@bluechip/domain/analytics/Metrics"
import { isForbiddenProperty } from "@bluechip/domain/analytics/Properties"
import { ServerEvent } from "@bluechip/domain/analytics/ServerEvents"
import { WebEvent } from "@bluechip/domain/analytics/WebEvents"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

describe("the event catalogue", () => {
  it("every name is unique", () => {
    const names = EVENTS.map((event) => event.name)

    assert.deepStrictEqual(names.filter((name, index) => names.indexOf(name) !== index), [])
  })

  it("names are snake_case and not PostHog's own ($)", () => {
    assert.deepStrictEqual(EVENTS.filter((event) => !/^[a-z]+(_[a-z]+)*$/.test(event.name)), [])
  })

  it("no property has a forbidden name", () => {
    const forbidden = EVENTS.flatMap((event) =>
      event.properties.filter(isForbiddenProperty).map((property) => `${event.name}.${property}`)
    )

    assert.deepStrictEqual(forbidden, [])
  })

  it("exact dollars (usd) only on server events, and the faucet's request", () => {
    const withUsd = EVENTS.filter((event) => event.properties.includes("usd")).map((event) => [event.by, event.name])

    assert.deepStrictEqual(withUsd, [
      ["server", "deposit_detected"],
      ["server", "faucet_minted"],
      ["server", "faucet_refused"],
      ["server", "trade_filled"],
      ["web", "faucet_requested"]
    ])
  })

  it("the money facts are server events", () => {
    const by = Object.fromEntries(EVENTS.map((event) => [event.name, event.by]))

    assert.deepStrictEqual(
      ["signed_up", "first_funded", "trade_filled", "agent_locked", "approval_signed", "automation_fired"].map(
        (name) => by[name]
      ),
      ["server", "server", "server", "server", "server", "server"]
    )
  })

  it("a web event doesn't decode as a server event", () => {
    const decoded = Schema.decodeUnknownOption(ServerEvent)({ _tag: "signup_started" })

    assert.strictEqual(decoded._tag, "None")
  })

  it("toCapture: the name, and the properties without the tag", () => {
    const event = WebEvent.make({ _tag: "stock_viewed", symbol: "NVDA", from: "home" })

    assert.deepStrictEqual(toCapture(event), { event: "stock_viewed", properties: { symbol: "NVDA", from: "home" } })
  })
})

describe("isForbiddenProperty", () => {
  it.each(
    [
      { property: "deposit_address", forbidden: true },
      { property: "display_name", forbidden: true },
      { property: "email", forbidden: true },
      { property: "usd_balance", forbidden: true },
      { property: "symbol", forbidden: false },
      { property: "usd_bucket", forbidden: false },
      { property: "kind", forbidden: false }
    ] as const
  )("$property: $forbidden", ({ forbidden, property }) => {
    assert.strictEqual(isForbiddenProperty(property), forbidden)
  })
})

describe("the metric catalogue", () => {
  it("every name is unique", () => {
    const names = METRICS.map((metric) => metric.name)

    assert.deepStrictEqual(names.filter((name, index) => names.indexOf(name) !== index), [])
  })

  it("no attribute names an object or a person", () => {
    const leaks = METRICS.flatMap((metric) =>
      metric.attributes.filter((attribute) => FORBIDDEN_METRIC_ATTRIBUTES.includes(attribute)).map((attribute) =>
        `${metric.name}.${attribute}`
      )
    )

    assert.deepStrictEqual(leaks, [])
  })
})
