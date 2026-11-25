import { MarketStatus } from "@bluechip/domain/market/Market"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { marketPillProps } from "../../../src/lib/marketSession.ts"

const at = (iso: string) => DateTime.makeUnsafe(iso)

describe("marketPillProps", () => {
  it("regular hours: open until today's close", () => {
    const status = new MarketStatus({
      session: "regular",
      pausedFor: null,
      changesAt: at("2026-11-25T21:00:00Z"),
      opensAt: at("2026-11-25T14:30:00Z"),
      closesAt: at("2026-11-25T21:00:00Z"),
      asOf: at("2026-11-25T15:00:00Z")
    })
    assert.deepStrictEqual(marketPillProps(status), { state: "open", closesAt: new Date("2026-11-25T21:00:00Z") })
  })

  it("regular hours without a known close: open", () => {
    const status = new MarketStatus({
      session: "regular",
      pausedFor: null,
      changesAt: at("2026-11-25T21:00:00Z"),
      opensAt: at("2026-11-25T14:30:00Z"),
      closesAt: null,
      asOf: at("2026-11-25T15:00:00Z")
    })
    assert.deepStrictEqual(marketPillProps(status), { state: "open" })
  })

  it("paused: resumes when the session changes", () => {
    const status = new MarketStatus({
      session: "paused",
      pausedFor: "weekend",
      changesAt: at("2026-11-30T01:00:00Z"),
      opensAt: at("2026-11-30T14:30:00Z"),
      closesAt: null,
      asOf: at("2026-11-28T12:00:00Z")
    })
    assert.deepStrictEqual(marketPillProps(status), { state: "paused", resumesAt: new Date("2026-11-30T01:00:00Z") })
  })

  it.each<{ name: string; session: "preMarket" | "afterHours" | "overnight"; label: string }>([
    { name: "pre-market", session: "preMarket", label: "Pre-market" },
    { name: "after hours", session: "afterHours", label: "After hours" },
    { name: "overnight", session: "overnight", label: "Overnight" }
  ])("$name: extended, named, until regular trading opens", ({ label, session }) => {
    const status = new MarketStatus({
      session,
      pausedFor: null,
      changesAt: at("2026-11-26T14:30:00Z"),
      opensAt: at("2026-11-26T14:30:00Z"),
      closesAt: null,
      asOf: at("2026-11-26T12:00:00Z")
    })
    assert.deepStrictEqual(marketPillProps(status), {
      state: "extended",
      session: label,
      opensAt: new Date("2026-11-26T14:30:00Z")
    })
  })
})
