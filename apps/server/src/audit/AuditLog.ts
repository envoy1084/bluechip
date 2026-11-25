import { AuditEvent } from "@bluechip/domain/audit/Audit"
import type { Actor } from "@bluechip/domain/audit/Audit"
import type { AuditEventId, UserId } from "@bluechip/domain/Ids"
import { and, desc, eq, lt } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import type * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { auditEvents } from "../db/schema/intents.ts"

/** What happened, for the audit trail. */
export interface AuditEntry {
  readonly userId: UserId
  readonly actor: Actor
  readonly actorId?: string | null | undefined
  /** `subject.verb`: `intent.filled`, `agent.paused`. */
  readonly action: string
  readonly subjectType: string
  readonly subjectId: string
  readonly data?: unknown
}

/** Records one entry in the audit trail. */
export const recordAudit = Effect.fnUntraced(function*(entry: AuditEntry) {
  const db = yield* Database
  yield* db.insert(auditEvents).values({
    id: typeid("audit").toString() as `audit_${string}`,
    userId: entry.userId as `user_${string}`,
    actor: entry.actor,
    actorId: entry.actorId ?? null,
    action: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
    data: entry.data ?? {},
    at: yield* DateTime.now
  }).pipe(Effect.orDie)
})

/** A page of the user's audit trail, newest first; `before` is the previous page's last id. */
export const auditPage = Effect.fnUntraced(
  function*(userId: UserId, options: { readonly size: number; readonly before?: string | undefined }) {
    const db = yield* Database
    const rows = yield* db.select().from(auditEvents).where(and(
      eq(auditEvents.userId, userId as `user_${string}`),
      options.before === undefined ? undefined : lt(auditEvents.id, options.before as `audit_${string}`)
    )).orderBy(desc(auditEvents.id)).limit(options.size + 1).pipe(Effect.orDie)

    const items = rows.slice(0, options.size).map((row) =>
      new AuditEvent({
        id: row.id as AuditEventId,
        actor: row.actor,
        actorId: row.actorId,
        action: row.action,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        data: row.data as Schema.Json,
        at: row.at
      })
    )
    return { items, nextPageToken: rows.length > options.size ? items.at(-1)!.id as string : null }
  }
)
