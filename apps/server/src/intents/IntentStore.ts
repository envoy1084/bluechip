import { Conflict } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, IntentId, TradeId, UserId } from "@bluechip/domain/Ids"
import { Decision, Intent, type IntentEvent, type IntentStatus, Leg, transition } from "@bluechip/domain/intents/Intent"
import { and, eq, inArray, lt } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { recordAudit } from "../audit/AuditLog.ts"
import { Database } from "../db/Database.ts"
import { intents } from "../db/schema/intents.ts"
import { LiveEvents } from "../live/LiveEvents.ts"

export type IntentRow = typeof intents.$inferSelect

const LegJson = Schema.toCodecJson(Leg)
const DecisionJson = Schema.toCodecJson(Decision)

export const encodeLeg = (leg: Leg): unknown => Schema.encodeSync(LegJson)(leg)
export const decodeLeg = (stored: unknown): Leg => Schema.decodeUnknownSync(LegJson)(stored)
export const encodeDecision = (decision: Decision): unknown => Schema.encodeSync(DecisionJson)(decision)
export const decodeDecision = (stored: unknown): Decision => Schema.decodeUnknownSync(DecisionJson)(stored)

/** An intent as the API returns it. */
export const toIntent = (row: IntentRow): Intent =>
  new Intent({
    id: row.id as IntentId,
    agentId: row.agentId as AgentId | null,
    source: row.source,
    executor: row.executor,
    leg: decodeLeg(row.leg),
    reason: row.reason,
    status: row.status,
    decision: row.decision === null ? null : decodeDecision(row.decision),
    tradeId: row.tradeId as TradeId | null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  })

/** The intent with this id. */
export const intentRow = Effect.fnUntraced(function*(id: string) {
  const db = yield* Database
  const [row] = yield* db.select().from(intents).where(eq(intents.id, id as `intent_${string}`)).pipe(Effect.orDie)
  return row
})

/**
 * Moves an intent on by `event` (and saves `changes` with it), then tells its owner (`IntentChanged`) and records the
 * step in the audit trail. Fails with `Conflict` when the intent has already moved past where `event` applies, so a
 * repeated step (after a restart, or a double click) changes nothing.
 */
export const advance = Effect.fnUntraced(function*(
  row: IntentRow,
  event: IntentEvent,
  changes: Partial<IntentRow> = {}
) {
  const db = yield* Database
  const live = yield* LiveEvents
  const next = transition(row.status, event)
  if (Result.isFailure(next)) return yield* new Conflict({ reason: "intentClosed" })

  const decision = event._tag === "Decided" ? { decision: encodeDecision(event.decision) } : {}
  const [updated] = yield* db.update(intents)
    .set({ ...changes, ...decision, status: next.success, updatedAt: yield* DateTime.now })
    .where(eq(intents.id, row.id)).returning().pipe(Effect.orDie)

  const intent = toIntent(updated!)
  yield* live.publish(LiveEvent.cases.IntentChanged.make({ intent }), row.userId as UserId)
  yield* recordAudit({
    userId: row.userId as UserId,
    actor: actorOf(row, event),
    actorId: row.executor === "agent" ? row.agentId : null,
    action: `intent.${next.success}`,
    subjectType: "intent",
    subjectId: row.id,
    data: event._tag === "Decided" ? { decision: encodeDecision(event.decision) } : {}
  })
  return updated!
})

// Who moved it: you sign, decline and cancel (pausing or removing an agent cancels its intents); the agent's key
// sends; the rest is bluechip deciding and following.
const actorOf = (row: IntentRow, event: IntentEvent) => {
  if (event._tag === "Signed" || event._tag === "Declined" || event._tag === "Cancelled") return "owner" as const
  if (event._tag === "Accepted" && row.executor === "agent") return "agent" as const
  return "system" as const
}

const OPEN: ReadonlyArray<IntentStatus> = ["proposed", "waiting", "needsApproval", "awaitingSignature"]

/** Cancels an agent's intents that haven't been sent: it was paused or removed, or its policies changed. */
export const cancelAgentIntents = Effect.fnUntraced(function*(agentId: string) {
  const db = yield* Database
  const open = yield* db.select().from(intents)
    .where(and(eq(intents.agentId, agentId as `agent_${string}`), inArray(intents.status, OPEN)))
    .pipe(Effect.orDie)
  for (const row of open) yield* advance(row, { _tag: "Cancelled" }).pipe(Effect.ignore)
})

/** Expires approvals and signatures left open past their time. */
export const expireIntents = Effect.gen(function*() {
  const db = yield* Database
  const now = yield* DateTime.now
  const stale = yield* db.select().from(intents).where(and(
    inArray(intents.status, ["needsApproval", "awaitingSignature", "waiting"]),
    lt(intents.expiresAt, now)
  )).pipe(Effect.orDie)
  for (const row of stale) yield* advance(row, { _tag: "Expired" }).pipe(Effect.ignore)
})
