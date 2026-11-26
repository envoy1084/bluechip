/**
 * The audit trail: who did what to what, and when. Written by the server as things happen; shown on the audit log
 * page, filtered and exported as JSON.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { AuditEventId } from "../Ids.ts"

/**
 * The kinds of thing the audit trail records, by the subject of their action (`intent.filled` is an `intent`): what
 * the audit log filters by.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AuditType = Schema.Literals([
  "intent",
  "agent",
  "automation",
  "channel",
  "passkey",
  "recovery",
  "device"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AuditType = typeof AuditType.Type

/**
 * Who acted: you, one of your agents (its key), the assistant, an automation, or bluechip itself.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Actor = Schema.Literals(["owner", "agent", "assistant", "automation", "system"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Actor = typeof Actor.Type

/**
 * One thing that happened.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AuditEvent extends Schema.Class<AuditEvent>("@bluechip/domain/audit/Audit/AuditEvent")({
  id: AuditEventId,
  actor: Actor,
  actorId: Schema.NullOr(Schema.String),
  /** What happened, as `subject.verb`: `intent.filled`, `agent.paused`, `session.locked`. */
  action: Schema.String,
  subjectType: Schema.String,
  subjectId: Schema.String,
  /** The agent it concerns: the one that acted, or the one acted on. */
  agentId: Schema.NullOr(Schema.String),
  data: Schema.Json,
  at: Schema.DateTimeUtc
}) {}
