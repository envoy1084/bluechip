import { AuditEvent } from "@bluechip/domain/audit/Audit"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  auditData,
  auditExactTime,
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
  it("your own entry: when, the action, the subject and its id", () => {
    assert.deepStrictEqual(auditRecord(AUDIT_EVENT, "UTC"), [
      { label: "When", value: "Fri 27 Nov 2026, 10:00:00" },
      { label: "Action", value: "device.signedIn" },
      { label: "Subject", value: "session session_01" },
      { label: "Entry", value: "audit_01jdzm3q8gfr9ab6t7c5h2kxyz" }
    ])
  })

  it("an agent's entry names the agent once when it acted itself", () => {
    const event = new AuditEvent({ ...AUDIT_EVENT, actor: "agent", actorId: "agent_01", agentId: "agent_01" })
    assert.deepStrictEqual(auditRecord(event, "UTC").map((field) => field.label), [
      "When",
      "Action",
      "Subject",
      "Agent",
      "Entry"
    ])
  })

  it("an actor other than the agent is named too", () => {
    const event = new AuditEvent({ ...AUDIT_EVENT, actorId: "user_01", agentId: "agent_01" })
    assert.deepStrictEqual(auditRecord(event, "UTC").map((field) => field.label), [
      "When",
      "Action",
      "Subject",
      "Agent",
      "Actor",
      "Entry"
    ])
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
