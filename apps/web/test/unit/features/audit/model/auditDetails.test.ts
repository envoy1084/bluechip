import { AuditEvent } from "@bluechip/domain/audit/Audit"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  auditData,
  auditExactTime,
  auditIds,
  auditRecord,
  auditWhen
} from "../../../../../src/features/audit/model/auditDetails.ts"
import { AUDIT_EVENT } from "../../../../fixtures/Audit.ts"

describe("auditWhen", () => {
  it.each([
    { name: "seconds ago", at: "2026-11-27T11:59:40Z", expected: "Just now" },
    { name: "minutes ago", at: "2026-11-27T11:48:00Z", expected: "12 min ago" },
    { name: "hours ago", at: "2026-11-27T09:00:00Z", expected: "3 h ago" },
    { name: "just under a day", at: "2026-11-26T12:00:01Z", expected: "23 h ago" },
    { name: "a day or more: the time", at: "2026-11-26T08:05:00Z", expected: "08:05" }
  ])("$name", ({ at, expected }) => {
    assert.strictEqual(auditWhen(DateTime.makeUnsafe(at), new Date("2026-11-27T12:00:00Z"), "UTC"), expected)
  })

  it("the time in the viewer's zone", () => {
    assert.strictEqual(
      auditWhen(DateTime.makeUnsafe("2026-11-20T08:05:00Z"), new Date("2026-11-27T12:00:00Z"), "Asia/Tokyo"),
      "17:05"
    )
  })
})

describe("auditExactTime", () => {
  it.each([
    { timeZone: "UTC", expected: "Fri 27 Nov 2026, 10:00:00" },
    { timeZone: "Asia/Tokyo", expected: "Fri 27 Nov 2026, 19:00:00" }
  ])("$timeZone", ({ expected, timeZone }) => {
    assert.strictEqual(auditExactTime(AUDIT_EVENT.at, timeZone), expected)
  })
})

describe("auditRecord", () => {
  it("your own entry: when, in words", () => {
    assert.deepStrictEqual(auditRecord(AUDIT_EVENT, "UTC"), [{ label: "When", value: "Fri 27 Nov 2026, 10:00:00" }])
  })

  it("an agent's entry names the agent", () => {
    const event = new AuditEvent({ ...AUDIT_EVENT, actor: "agent", actorId: "agent_01", agentId: "agent_01" })

    assert.deepStrictEqual(auditRecord(event, "UTC", (id) => id === "agent_01" ? "Tech picker" : undefined), [
      { label: "When", value: "Fri 27 Nov 2026, 10:00:00" },
      { label: "Agent", value: "Tech picker" }
    ])
  })

  it("an agent no longer listed: the name the entry carries", () => {
    const event = new AuditEvent({ ...AUDIT_EVENT, agentId: "agent_01", data: { name: "Index keeper" } })

    assert.deepStrictEqual(auditRecord(event, "UTC")[1], { label: "Agent", value: "Index keeper" })
  })
})

describe("auditIds", () => {
  it("the entry's and its subject's, named", () => {
    assert.deepStrictEqual(auditIds(AUDIT_EVENT), [
      { label: "Entry", id: "audit_01jdzm3q8gfr9ab6t7c5h2kxyz" },
      { label: "Device", id: "session_01" }
    ])
  })

  it("a trade by an agent: the agent's too", () => {
    const event = new AuditEvent({
      ...AUDIT_EVENT,
      action: "intent.filled",
      subjectType: "intent",
      subjectId: "intent_01",
      agentId: "agent_01"
    })

    assert.deepStrictEqual(auditIds(event).map((each) => each.label), ["Entry", "Trade", "Agent"])
  })

  it("an entry about the agent itself: its id once", () => {
    const event = new AuditEvent({
      ...AUDIT_EVENT,
      action: "agent.paused",
      subjectType: "agent",
      subjectId: "agent_01",
      agentId: "agent_01"
    })

    assert.deepStrictEqual(auditIds(event).map((each) => each.label), ["Entry", "Agent"])
  })
})

describe("auditData", () => {
  it.each([
    { name: "fields", data: { device: "Chrome on Mac" }, expected: "{\n  \"device\": \"Chrome on Mac\"\n}" },
    { name: "no fields", data: {}, expected: null },
    { name: "an empty list", data: [], expected: null },
    { name: "null", data: null, expected: null },
    { name: "a plain value", data: "note", expected: "\"note\"" }
  ])("$name", ({ data, expected }) => {
    assert.strictEqual(auditData(new AuditEvent({ ...AUDIT_EVENT, data })), expected)
  })
})
