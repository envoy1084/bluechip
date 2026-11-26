import { AuditEvent } from "@bluechip/domain/audit/Audit"
import type { Actor, AuditType } from "@bluechip/domain/audit/Audit"
import type { AuditEventId, UserId } from "@bluechip/domain/Ids"
import { and, desc, eq, gte, like, lt } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { auditEvents } from "./tables.ts"

/** What happened, for the audit trail. */
export interface AuditEntry {
  readonly userId: UserId
  readonly actor: Actor
  readonly actorId?: string | null | undefined
  /** `subject.verb`: `intent.filled`, `agent.paused`. */
  readonly action: string
  readonly subjectType: string
  readonly subjectId: string
  /** The agent it concerns, when there is one: the one that acted, or the one acted on. */
  readonly agentId?: string | null | undefined
  readonly data?: unknown
}

/** Which events to read: a kind of thing, one agent, between two times (`from` inclusive, `to` exclusive). */
export interface AuditFilter {
  readonly type?: AuditType | undefined
  readonly agentId?: string | undefined
  readonly from?: DateTime.Utc | undefined
  readonly to?: DateTime.Utc | undefined
}

/** The most events one export holds. */
const EXPORT_LIMIT = 10_000

type AuditRow = typeof auditEvents.$inferSelect

const toEvent = (row: AuditRow) =>
  new AuditEvent({
    id: row.id as AuditEventId,
    actor: row.actor,
    actorId: row.actorId,
    action: row.action,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    agentId: row.agentId,
    data: row.data as Schema.Json,
    at: row.at
  })

/** Who did what to what, and when: every user's audit trail. */
export class AuditLog extends Context.Service<AuditLog, {
  /** Records one entry in the audit trail. */
  readonly record: (entry: AuditEntry) => Effect.Effect<void>
  /** A page of the user's audit trail matching `filter`, newest first; `before` is the previous page's last id. */
  readonly page: (
    userId: UserId,
    options: AuditFilter & { readonly size: number; readonly before?: string | undefined }
  ) => Effect.Effect<{ readonly items: ReadonlyArray<AuditEvent>; readonly nextPageToken: string | null }>
  /** Every event of the user's matching `filter`, newest first, up to 10,000. */
  readonly export: (userId: UserId, filter: AuditFilter) => Effect.Effect<ReadonlyArray<AuditEvent>>
}>()("@bluechip/server/AuditLog") {
  static readonly layer = Layer.effect(
    AuditLog,
    Effect.gen(function*() {
      const db = yield* Database

      const record = Effect.fn("AuditLog.record")(function*(entry: AuditEntry) {
        yield* db.insert(auditEvents).values({
          id: typeid("audit").toString() as `audit_${string}`,
          userId: entry.userId as `user_${string}`,
          actor: entry.actor,
          actorId: entry.actorId ?? null,
          action: entry.action,
          subjectType: entry.subjectType,
          subjectId: entry.subjectId,
          agentId: entry.agentId ?? null,
          data: entry.data ?? {},
          at: yield* DateTime.now
        }).pipe(Effect.orDie)
      })

      // Actions are `subject.verb`, so a kind of thing is the actions starting with its name.
      const matching = (userId: UserId, filter: AuditFilter) =>
        and(
          eq(auditEvents.userId, userId as `user_${string}`),
          filter.type === undefined ? undefined : like(auditEvents.action, `${filter.type}.%`),
          filter.agentId === undefined ? undefined : eq(auditEvents.agentId, filter.agentId),
          filter.from === undefined ? undefined : gte(auditEvents.at, filter.from),
          filter.to === undefined ? undefined : lt(auditEvents.at, filter.to)
        )

      const page = Effect.fn("AuditLog.page")(function*(
        userId: UserId,
        options: AuditFilter & { readonly size: number; readonly before?: string | undefined }
      ) {
        const rows = yield* db.select().from(auditEvents).where(and(
          matching(userId, options),
          options.before === undefined ? undefined : lt(auditEvents.id, options.before as `audit_${string}`)
        )).orderBy(desc(auditEvents.id)).limit(options.size + 1).pipe(Effect.orDie)

        const items = rows.slice(0, options.size).map(toEvent)
        return { items, nextPageToken: rows.length > options.size ? items.at(-1)!.id as string : null }
      })

      const exportAll = Effect.fn("AuditLog.export")(function*(userId: UserId, filter: AuditFilter) {
        const rows = yield* db.select().from(auditEvents).where(matching(userId, filter))
          .orderBy(desc(auditEvents.id)).limit(EXPORT_LIMIT).pipe(Effect.orDie)
        return rows.map(toEvent)
      })

      return AuditLog.of({ record, page, export: exportAll })
    })
  )
}
