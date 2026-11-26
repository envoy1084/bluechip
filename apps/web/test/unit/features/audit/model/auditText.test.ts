import { AuditEvent } from "@bluechip/domain/audit/Audit"
import { assert, describe, it } from "@effect/vitest"
import {
  actorLabel,
  auditSubject,
  auditTone,
  auditTypeOf,
  describeAudit,
  matchesAuditSearch
} from "../../../../../src/features/audit/model/auditText.ts"
import { AUDIT_EVENT } from "../../../../fixtures/Audit.ts"

const AGENT_NAMES = new Map([["agent_01", "Tech picker"]])

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
    assert.strictEqual(describeAudit(new AuditEvent({ ...AUDIT_EVENT, action, data })), expected)
  })
})

describe("actorLabel", () => {
  it.each(
    [
      { name: "you", actor: "owner", actorId: null, data: {}, expected: "You" },
      { name: "an agent it knows", actor: "agent", actorId: "agent_01", data: {}, expected: "Tech picker" },
      {
        name: "an agent it doesn't know, named in the entry",
        actor: "agent",
        actorId: "agent_02",
        data: { name: "Old picker" },
        expected: "Old picker"
      },
      { name: "an agent without a name", actor: "agent", actorId: "agent_02", data: {}, expected: "An agent" },
      { name: "the assistant", actor: "assistant", actorId: null, data: {}, expected: "The assistant" },
      { name: "an automation", actor: "automation", actorId: null, data: {}, expected: "An automation" },
      { name: "bluechip", actor: "system", actorId: null, data: {}, expected: "bluechip" }
    ] as const
  )("$name", ({ actor, actorId, data, expected }) => {
    assert.strictEqual(
      actorLabel(new AuditEvent({ ...AUDIT_EVENT, actor, actorId, data }), (id) => AGENT_NAMES.get(id)),
      expected
    )
  })

  it("an agent, without names to look up", () => {
    assert.strictEqual(actorLabel(new AuditEvent({ ...AUDIT_EVENT, actor: "agent", actorId: "agent_01" })), "An agent")
  })
})

describe("auditTypeOf", () => {
  it.each(
    [
      { action: "intent.filled", expected: "intent" },
      { action: "channel.linked", expected: "channel" },
      { action: "session.locked", expected: undefined }
    ] as const
  )("$action", ({ action, expected }) => {
    assert.strictEqual(auditTypeOf(new AuditEvent({ ...AUDIT_EVENT, action })), expected)
  })
})

describe("auditTone", () => {
  it.each(
    [
      { action: "intent.filled", expected: "gain" },
      { action: "intent.blocked", expected: "loss" },
      { action: "intent.needsApproval", expected: "warn" },
      { action: "device.signedIn", expected: "plain" }
    ] as const
  )("$action", ({ action, expected }) => {
    assert.strictEqual(auditTone(new AuditEvent({ ...AUDIT_EVENT, action })), expected)
  })
})

describe("auditSubject", () => {
  it.each(
    [
      {
        name: "an agent's trade",
        entry: { action: "intent.filled", subjectId: "intent_01", agentId: "agent_01", data: {} },
        expected: { _tag: "Trade", agentId: "agent_01", label: "Tech picker's trade" }
      },
      {
        name: "your own trade",
        entry: { action: "intent.declined", subjectId: "intent_01", agentId: null, data: {} },
        expected: { _tag: "Trade", agentId: null, label: "Your trade" }
      },
      {
        name: "an agent, by its name in the entry when it's gone",
        entry: { action: "agent.removed", subjectId: "agent_09", agentId: "agent_09", data: { name: "Old picker" } },
        expected: { _tag: "Agent", agentId: "agent_09", label: "Old picker" }
      },
      {
        name: "an automation",
        entry: { action: "automation.created", subjectId: "automation_01", agentId: null, data: {} },
        expected: { _tag: "Automation", automationId: "automation_01", label: "Automation" }
      },
      {
        name: "a passkey, by its label",
        entry: { action: "passkey.added", subjectId: "passkey_01", agentId: null, data: { label: "YubiKey" } },
        expected: { _tag: "Security", label: "YubiKey" }
      },
      {
        name: "a device, by its name",
        entry: { action: "device.signedIn", subjectId: "session_01", agentId: null, data: { device: "Chrome on Mac" } },
        expected: { _tag: "Security", label: "Chrome on Mac" }
      },
      {
        name: "a recovery",
        entry: { action: "recovery.requested", subjectId: "recovery_01", agentId: null, data: {} },
        expected: { _tag: "Security", label: "Recovery" }
      },
      {
        name: "a chat, by its platform",
        entry: { action: "channel.linked", subjectId: "link_01", agentId: null, data: { platform: "telegram" } },
        expected: { _tag: "Chats", label: "Telegram" }
      }
    ] as const
  )("$name", ({ entry, expected }) => {
    assert.deepStrictEqual(
      auditSubject(new AuditEvent({ ...AUDIT_EVENT, ...entry }), (id) => AGENT_NAMES.get(id)),
      expected
    )
  })

  it("nothing, for an action of no known kind", () => {
    assert.strictEqual(auditSubject(new AuditEvent({ ...AUDIT_EVENT, action: "session.locked" })), undefined)
  })
})

describe("matchesAuditSearch", () => {
  it.each([
    { name: "a word of what happened", search: "filled", expected: true },
    { name: "any case", search: "TECH", expected: true },
    { name: "every word, in any field", search: "trade picker", expected: true },
    { name: "a word that isn't there", search: "passkey", expected: false },
    { name: "an empty search", search: "  ", expected: true }
  ])("$name", ({ expected, search }) => {
    assert.strictEqual(matchesAuditSearch(["A trade filled", "Tech picker"], search), expected)
  })
})
