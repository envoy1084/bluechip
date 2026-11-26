import { stocks } from "@bluechip/chain/Contracts"
import { Conflict, NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, IntentId, TradeId, UserId } from "@bluechip/domain/Ids"
import {
  Decision,
  Intent,
  type IntentEvent,
  type IntentSource,
  type IntentStatus,
  type Leg,
  transition
} from "@bluechip/domain/intents/Intent"
import { journalOfIntent } from "@bluechip/domain/journal/Journal"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { AgentJournal } from "../journal/AgentJournal.ts"
import { NotificationOutbox } from "../notifications/Outbox.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { intents } from "./tables.ts"

const nameOf = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

export type IntentRow = typeof intents.$inferSelect

/** A trade someone asked for: yours (`agentId` null) or one of your agents'. */
export type IntentInput = {
  readonly requestId: string
  readonly agentId: AgentId | null
  readonly leg: Leg
  readonly reason?: string | undefined
  readonly source?: IntentSource | undefined
  readonly sourceId?: string | undefined
  /** What makes it one intent, instead of the request id: an automation's window and leg. */
  readonly dedupeKey?: string | undefined
  /** Waits for your approval whatever the agent's policies allow (an automation that asks you first). */
  readonly ask?: boolean | undefined
}

/** An intent as the API returns it. */
export const toIntent = (row: IntentRow): Intent =>
  new Intent({
    id: row.id as IntentId,
    agentId: row.agentId as AgentId | null,
    source: row.source,
    executor: row.executor,
    leg: row.leg,
    reason: row.reason,
    status: row.status,
    decision: row.decision,
    tradeId: row.tradeId as TradeId | null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  })

// How long a waiting agent trade keeps trying.
const OPEN_HOURS = 6

const OPEN: ReadonlyArray<IntentStatus> = ["proposed", "waiting", "needsApproval", "awaitingSignature"]

/**
 * The intents table: intents are created once per request id, read by their owner, and moved on only through
 * `advance`, which tells the owner (`IntentChanged`) and records each step in the audit trail.
 */
export class IntentStore extends Context.Service<IntentStore, {
  /** The intent with this id. */
  readonly find: (id: string) => Effect.Effect<IntentRow | undefined>
  /** The owner's intent with this id. */
  readonly owned: (owner: Owner, id: string) => Effect.Effect<IntentRow, NotFound>
  /** The intent a trade carried out. */
  readonly byTrade: (tradeId: string) => Effect.Effect<IntentRow | undefined>
  /** The intent under this request id, or a new one (`created`). */
  readonly insert: (
    owner: Owner,
    input: IntentInput
  ) => Effect.Effect<{ readonly row: IntentRow; readonly created: boolean }>
  readonly remove: (id: IntentRow["id"]) => Effect.Effect<void>
  /** The owner's intents, newest first, a page at a time. */
  readonly list: (owner: Owner, query: {
    readonly agentId?: AgentId | undefined
    readonly status?: IntentStatus | undefined
    readonly source?: IntentSource | undefined
    readonly pageSize?: number | undefined
    readonly pageToken?: string | undefined
  }) => Effect.Effect<{ readonly items: ReadonlyArray<Intent>; readonly nextPageToken: string | null }>
  /**
   * Trades waiting for you: an agent's over its largest trade, one an automation asks you about, or one you approved
   * and that waits for your signature.
   */
  readonly approvals: (owner: Owner) => Effect.Effect<ReadonlyArray<Intent>>
  /**
   * Moves an intent on by `event` (and saves `changes` with it), from the status `row` was read in. Fails with
   * `Conflict`: `intentClosed` when that status doesn't take `event`, so a repeated step (after a restart, or a double
   * click) changes nothing; `intentChanged` when the intent moved since it was read, so of two moves racing from one
   * status (a decline landing during a send) only the first counts.
   */
  readonly advance: (
    row: IntentRow,
    event: IntentEvent,
    changes?: Partial<IntentRow>
  ) => Effect.Effect<IntentRow, Conflict>
  /** Cancels an agent's intents that haven't been sent: it was paused or removed, or its policies changed. */
  readonly cancelAgentIntents: (agentId: string) => Effect.Effect<void>
  /**
   * Expires approvals, signatures and waiting trades left open past their time: everyone's (the cron), or one user's.
   */
  readonly expire: (options?: { readonly userId?: UserId | undefined }) => Effect.Effect<void>
}>()("@bluechip/server/IntentStore") {
  static readonly layer = Layer.effect(
    IntentStore,
    Effect.gen(function*() {
      const db = yield* Database
      const live = yield* LiveEvents
      const outbox = yield* NotificationOutbox
      const audit = yield* AuditLog
      const journal = yield* AgentJournal

      const find = Effect.fn("IntentStore.find")(function*(id: string) {
        const [row] = yield* db.select().from(intents).where(eq(intents.id, id as `intent_${string}`)).pipe(
          Effect.orDie
        )
        return row
      })

      const owned = Effect.fn("IntentStore.owned")(function*(owner: Owner, id: string) {
        const [row] = yield* db.select().from(intents)
          .where(and(eq(intents.id, id as `intent_${string}`), eq(intents.userId, owner.id as `user_${string}`)))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "intent", id })
        return row
      })

      const byTrade = Effect.fn("IntentStore.byTrade")(function*(tradeId: string) {
        const [row] = yield* db.select().from(intents).where(eq(intents.tradeId, tradeId as `trade_${string}`))
          .pipe(Effect.orDie)
        return row
      })

      const insert = Effect.fn("IntentStore.insert")(function*(owner: Owner, input: IntentInput) {
        const now = yield* DateTime.now
        const dedupeKey = input.dedupeKey ?? `request:${input.requestId}`
        const ask = input.ask ?? false
        const [created] = yield* db.insert(intents).values({
          id: typeid("intent").toString() as `intent_${string}`,
          userId: owner.id as `user_${string}`,
          agentId: input.agentId as `agent_${string}` | null,
          source: input.source ?? "owner",
          sourceId: input.sourceId ?? null,
          executor: input.agentId === null ? "owner" : "agent",
          ask,
          dedupeKey,
          leg: input.leg,
          reason: input.reason ?? (input.agentId === null ? "You traded." : "You asked this agent to trade."),
          status: "proposed",
          expiresAt: input.agentId === null && !ask ? null : DateTime.add(now, { hours: OPEN_HOURS }),
          createdAt: now,
          updatedAt: now
        }).onConflictDoNothing().returning().pipe(Effect.orDie)
        if (created !== undefined) return { row: created, created: true }

        const [existing] = yield* db.select().from(intents).where(and(
          eq(intents.userId, owner.id as `user_${string}`),
          eq(intents.dedupeKey, dedupeKey)
        )).pipe(Effect.orDie)
        return { row: existing!, created: false }
      })

      const remove = (id: IntentRow["id"]) => db.delete(intents).where(eq(intents.id, id)).pipe(Effect.ignore)

      const list = Effect.fn("IntentStore.list")(function*(owner: Owner, query: {
        readonly agentId?: AgentId | undefined
        readonly status?: IntentStatus | undefined
        readonly source?: IntentSource | undefined
        readonly pageSize?: number | undefined
        readonly pageToken?: string | undefined
      }) {
        const size = query.pageSize ?? 25
        const rows = yield* db.select().from(intents).where(and(
          eq(intents.userId, owner.id as `user_${string}`),
          query.agentId === undefined ? undefined : eq(intents.agentId, query.agentId as `agent_${string}`),
          query.status === undefined ? undefined : eq(intents.status, query.status),
          query.source === undefined ? undefined : eq(intents.source, query.source),
          query.pageToken === undefined ? undefined : lt(intents.id, query.pageToken as `intent_${string}`)
        )).orderBy(desc(intents.id)).limit(size + 1).pipe(Effect.orDie)

        const items = rows.slice(0, size).map(toIntent)
        return { items, nextPageToken: rows.length > size ? items.at(-1)!.id as string : null }
      })

      const approvals = Effect.fn("IntentStore.approvals")(function*(owner: Owner) {
        const rows = yield* db.select().from(intents).where(and(
          eq(intents.userId, owner.id as `user_${string}`),
          or(isNotNull(intents.agentId), eq(intents.source, "automation")),
          inArray(intents.status, ["needsApproval", "awaitingSignature"])
        )).orderBy(desc(intents.id)).pipe(Effect.orDie)
        return rows.map(toIntent)
      })

      const advance = Effect.fn("IntentStore.advance")(
        function*(row: IntentRow, event: IntentEvent, changes: Partial<IntentRow> = {}) {
          const next = transition(row.status, event)
          if (Result.isFailure(next)) return yield* new Conflict({ reason: "intentClosed" })

          // Set only from the status it was read in: of two moves from one status (a decline and a send), the second
          // finds the status changed and loses.
          const decision = event._tag === "Decided" ? { decision: event.decision } : {}
          const now = yield* DateTime.now
          // The change and its event in the notifications' outbox, in one transaction.
          const updated = yield* db.transaction(() =>
            Effect.gen(function*() {
              const [updated] = yield* db.update(intents)
                .set({ ...changes, ...decision, status: next.success, updatedAt: now })
                .where(and(eq(intents.id, row.id), eq(intents.status, row.status))).returning()
              if (updated !== undefined) {
                yield* outbox.write(
                  LiveEvent.cases.IntentChanged.make({ intent: toIntent(updated) }),
                  row.userId as UserId
                )
              }
              return updated
            })
          ).pipe(Effect.orDie)
          if (updated === undefined) return yield* new Conflict({ reason: "intentChanged" })

          // The agent's journal next, so whoever hears of the change can read it there.
          const intent = toIntent(updated)
          const entry = intent.agentId === null ? undefined : journalOfIntent(intent, nameOf)
          if (entry !== undefined) {
            yield* journal.write({
              userId: row.userId as UserId,
              agentId: intent.agentId!,
              kind: "intent",
              entry,
              refs: { intentId: intent.id }
            })
          }
          yield* live.publish(LiveEvent.cases.IntentChanged.make({ intent }), row.userId as UserId)
          // Who moved it: you sign, decline and cancel (pausing or removing an agent cancels its intents); the agent's
          // key sends; the rest is bluechip deciding and following.
          const byOwner = event._tag === "Signed" || event._tag === "Declined" || event._tag === "Cancelled"
          const byAgent = event._tag === "Accepted" && row.executor === "agent"
          yield* audit.record({
            userId: row.userId as UserId,
            actor: byOwner ? "owner" : byAgent ? "agent" : "system",
            actorId: row.executor === "agent" ? row.agentId : null,
            agentId: row.agentId,
            action: `intent.${next.success}`,
            subjectType: "intent",
            subjectId: row.id,
            data: event._tag === "Decided"
              ? { decision: Schema.encodeSync(Schema.toCodecJson(Decision))(event.decision) }
              : {}
          })

          return updated
        }
      )

      const cancelAgentIntents = Effect.fn("IntentStore.cancelAgentIntents")(function*(agentId: string) {
        const open = yield* db.select().from(intents)
          .where(and(eq(intents.agentId, agentId as `agent_${string}`), inArray(intents.status, OPEN)))
          .pipe(Effect.orDie)
        for (const row of open) yield* advance(row, { _tag: "Cancelled" }).pipe(Effect.ignore)
      })

      const expire = Effect.fn("IntentStore.expire")(function*(options: { readonly userId?: UserId | undefined } = {}) {
        const now = yield* DateTime.now
        const stale = yield* db.select().from(intents).where(and(
          inArray(intents.status, ["needsApproval", "awaitingSignature", "waiting"]),
          lt(intents.expiresAt, now),
          options.userId === undefined ? undefined : eq(intents.userId, options.userId as `user_${string}`)
        )).pipe(Effect.orDie)
        for (const row of stale) yield* advance(row, { _tag: "Expired" }).pipe(Effect.ignore)

        // Your own trade claimed for sending, then never sent (the server stopped in between): nothing was traded.
        const unsent = yield* db.select().from(intents).where(and(
          eq(intents.status, "sending"),
          eq(intents.executor, "owner"),
          isNull(intents.userOpHash),
          lt(intents.expiresAt, DateTime.subtract(now, { hours: 1 })),
          options.userId === undefined ? undefined : eq(intents.userId, options.userId as `user_${string}`)
        )).pipe(Effect.orDie)
        for (const row of unsent) yield* advance(row, { _tag: "Failed" }).pipe(Effect.ignore)
      })

      return IntentStore.of({
        find,
        owned,
        byTrade,
        insert,
        remove,
        list,
        approvals,
        advance,
        cancelAgentIntents,
        expire
      })
    })
  )
}
