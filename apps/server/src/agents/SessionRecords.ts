import { placements } from "@bluechip/chain/policies/Session"
import type { SessionAuthor } from "@bluechip/domain/agents/Agent"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { asc, eq, inArray } from "drizzle-orm"
import type * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { agentSessions, sessionPolicies } from "../db/schema/agents.ts"
import type { SessionRow } from "./AgentRecords.ts"

type Transaction = Parameters<Parameters<Database["Service"]["transaction"]>[0]>[0]

/** A new draft session of `spec` for an agent, with a row per policy saying where it is enforced. */
export const insertSession = Effect.fnUntraced(function*(
  tx: Transaction,
  session: {
    readonly agentId: `agent_${string}`
    readonly spec: AgentSpec
    readonly sessionKey: string
    readonly permissionId: string | null
    readonly validUntil: DateTime.Utc
    readonly createdBy: SessionAuthor
    readonly now: DateTime.Utc
  }
) {
  const id = typeid("agentsession").toString() as `agentsession_${string}`
  const [row] = yield* tx.insert(agentSessions).values({
    id,
    agentId: session.agentId,
    spec: session.spec,
    sessionKey: session.sessionKey,
    permissionId: session.permissionId,
    validUntil: session.validUntil,
    status: "draft",
    createdBy: session.createdBy,
    createdAt: session.now
  }).returning()

  yield* tx.insert(sessionPolicies).values(
    placements(session.spec).map((placement, position) => ({
      sessionId: id,
      position,
      policy: placement.policy,
      kind: placement.kind,
      contract: placement.contract
    }))
  )
  return row!
})

/** Every session of these agents, oldest first. */
export const sessionsOf = Effect.fnUntraced(function*(agentIds: ReadonlyArray<string>) {
  if (agentIds.length === 0) return [] as ReadonlyArray<SessionRow>
  const db = yield* Database
  return yield* db.select().from(agentSessions)
    .where(inArray(agentSessions.agentId, agentIds as Array<`agent_${string}`>))
    .orderBy(asc(agentSessions.createdAt)).pipe(Effect.orDie)
})

/** A session by id. */
export const sessionRow = Effect.fnUntraced(function*(id: string | null) {
  const db = yield* Database
  const [row] = yield* db.select().from(agentSessions)
    .where(eq(agentSessions.id, id as `agentsession_${string}`)).pipe(Effect.orDie)
  return row!
})

/** Saves changes to a session. */
export const saveSession = Effect.fnUntraced(function*(id: string, changes: Partial<SessionRow>) {
  const db = yield* Database
  yield* db.update(agentSessions).set(changes).where(eq(agentSessions.id, id as `agentsession_${string}`))
    .pipe(Effect.orDie)
})
