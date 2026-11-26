// An audit entry as the audit log lists it: you, signing in on a Mac. Tests spread it with what they change.
import { AuditEvent } from "@bluechip/domain/audit/Audit"
import type { AuditEventId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"

export const AUDIT_EVENT = new AuditEvent({
  id: "audit_01jdzm3q8gfr9ab6t7c5h2kxyz" as AuditEventId,
  actor: "owner",
  actorId: null,
  action: "device.signedIn",
  subjectType: "session",
  subjectId: "session_01",
  agentId: null,
  data: { device: "Chrome on Mac" },
  at: DateTime.makeUnsafe("2026-11-27T10:00:00Z")
})
