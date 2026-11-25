/**
 * The audit trail: who did what to what, and when. Written by the server as things happen; shown in 021.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { AuditEventId } from "../Ids.ts"

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
  data: Schema.Json,
  at: Schema.DateTimeUtc
}) {}
