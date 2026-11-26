import { AuditEvent } from "@bluechip/domain/audit/Audit"
import type { AuditEventId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { actorLabel, describeAudit } from "../../../../../src/features/audit/model/auditText.ts"

const event = (action: string, data: AuditEvent["data"] = {}, actor: AuditEvent["actor"] = "owner") =>
  new AuditEvent({
    id: "audit_01jdzm3q8gfr9ab6t7c5h2kxyz" as AuditEventId,
    actor,
    actorId: null,
    action,
    subjectType: "x",
    subjectId: "x_01",
    agentId: null,
    data,
    at: DateTime.makeUnsafe("2026-11-27T10:00:00Z")
  })

describe("describeAudit", () => {
  it.each([
    { action: "intent.filled", data: {}, expected: "A trade filled" },
    { action: "intent.blocked", data: {}, expected: "A policy stopped a trade" },
    { action: "intent.somethingNew", data: {}, expected: "A trade changed" },
    {
      action: "agent.locking",
      data: { name: "Tech picker" },
      expected: "You locked Tech picker's policies with Face ID"
    },
    { action: "agent.paused", data: { name: "Tech picker" }, expected: "Tech picker was paused" },
    { action: "passkey.added", data: { label: "YubiKey" }, expected: "YubiKey became one of your passkeys" },
    { action: "passkey.removed", data: { label: null }, expected: "A passkey was removed from your passkeys" },
    { action: "recovery.requested", data: {}, expected: "Your recovery key asked to recover your account" },
    { action: "device.signedIn", data: { device: "Chrome on Mac" }, expected: "Chrome on Mac signed in" },
    { action: "device.signedOut", data: { everywhere: true }, expected: "Every other device was signed out" },
    { action: "something.else", data: {}, expected: "something.else" }
  ])("$action", ({ action, data, expected }) => {
    assert.strictEqual(describeAudit(event(action, data)), expected)
  })
})

describe("actorLabel", () => {
  it.each(
    [
      { actor: "owner", expected: "You" },
      { actor: "agent", expected: "An agent" },
      { actor: "assistant", expected: "The assistant" },
      { actor: "automation", expected: "An automation" },
      { actor: "system", expected: "bluechip" }
    ] as const
  )("$actor", ({ actor, expected }) => {
    assert.strictEqual(actorLabel(event("intent.filled", {}, actor)), expected)
  })
})
