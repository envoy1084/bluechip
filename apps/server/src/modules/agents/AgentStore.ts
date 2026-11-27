import { Agent, SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import { NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, UserId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { TEMPLATES } from "@bluechip/domain/policies/Templates"
import { and, asc, eq, inArray, lt, ne } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { AgentsCreated, AgentsLifecycle, AgentsLocked, count } from "../../platform/telemetry/Metrics.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { NotificationOutbox } from "../notifications/Outbox.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { AgentSessions, type SessionRow } from "./AgentSessions.ts"
import { agents, agentSessions } from "./tables.ts"

export type AgentRow = typeof agents.$inferSelect

/**
 * An agent as the API returns it, from its row and its sessions: the policies in force (a draft's are the ones it will
 * lock) and a change on its way.
 */
const toAgent = (row: AgentRow, sessions: ReadonlyArray<SessionRow>): Agent => {
  const current = sessions.find((session) => session.id === row.currentSessionId)
  const pending = sessions.find((session) => session.id === row.pendingSessionId)
  const inForce = current ?? pending!
  return new Agent({
    id: row.id as AgentId,
    name: row.name,
    template: row.templateId,
    status: row.status,
    paused: row.paused,
    spec: inForce.spec,
    pendingSpec: current !== undefined && pending !== undefined ? pending.spec : null,
    lockedUntil: current?.validUntil ?? null,
    createdAt: row.createdAt
  })
}

/** The agents table: each agent's row, read as the API returns it, and saved with word to its owner. */
// A built-in template by its id; a template of your own as `saved`; none as `custom`, so the metrics stay few.
const templateOf = (template: string | null) =>
  template === null ? "custom" : template in TEMPLATES ? template : "saved"

export class AgentStore extends Context.Service<AgentStore, {
  /** A new draft agent, with its first session (a new key, valid for 90 days) waiting to be locked. */
  readonly create: (owner: Owner, input: {
    readonly name: string
    readonly template: string | null
    readonly spec: AgentSpec
  }) => Effect.Effect<AgentRow>
  /** The owner's agent with this id. */
  readonly owned: (owner: Owner, id: AgentId) => Effect.Effect<AgentRow, NotFound>
  readonly get: (id: AgentRow["id"]) => Effect.Effect<AgentRow | undefined>
  /** The agent, its session in force when it has one, and whether it may trade now (active, not paused). */
  readonly tradingState: (id: string) => Effect.Effect<{
    readonly agent: AgentRow | undefined
    readonly session: SessionRow | undefined
    readonly canTrade: boolean
  }>
  /** The owner's agents not removed, oldest first. */
  readonly list: (owner: Owner) => Effect.Effect<ReadonlyArray<Agent>>
  /** The owner's agents that can trade (or are on their way to), paused or not. */
  readonly running: (owner: Owner, paused: boolean) => Effect.Effect<ReadonlyArray<AgentRow>>
  /** Active agents whose session ended before `now`: everyone's, or one user's. */
  readonly pastEnd: (now: DateTime.Utc, userId?: UserId | undefined) => Effect.Effect<ReadonlyArray<AgentRow>>
  /** Agents with an owner operation on its way, to follow after a restart. */
  readonly inFlight: Effect.Effect<ReadonlyArray<AgentRow>>
  readonly toAgent: (row: AgentRow) => Effect.Effect<Agent>
  /** Saves changes to an agent and tells its owner (`AgentChanged`, with the `change` notifications tell). */
  readonly save: (
    row: AgentRow,
    changes: Partial<AgentRow>,
    change?: "paused" | "renewed" | undefined
  ) => Effect.Effect<Agent>
}>()("@bluechip/server/AgentStore") {
  static readonly layer = Layer.effect(
    AgentStore,
    Effect.gen(function*() {
      const db = yield* Database
      const live = yield* LiveEvents
      const outbox = yield* NotificationOutbox
      const audit = yield* AuditLog
      const sessions = yield* AgentSessions

      const create = Effect.fn("AgentStore.create")(function*(owner: Owner, input: {
        readonly name: string
        readonly template: string | null
        readonly spec: AgentSpec
      }) {
        const id = typeid("agent").toString() as `agent_${string}`
        const now = yield* DateTime.now
        return yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.insert(agents).values({
              id,
              userId: owner.id as `user_${string}`,
              name: input.name,
              templateId: input.template,
              status: "draft",
              createdAt: now,
              updatedAt: now
            })
            const session = yield* sessions.insert(tx, {
              agentId: id,
              spec: input.spec,
              sessionKey: yield* sessions.newKey(tx, id, now),
              permissionId: null,
              validUntil: DateTime.add(now, { days: SESSION_DAYS }),
              createdBy: "owner",
              now
            })
            const [inserted] = yield* tx.update(agents).set({ pendingSessionId: session.id })
              .where(eq(agents.id, id)).returning()
            return inserted!
          })
        ).pipe(Effect.orDie, Effect.tap(count(AgentsCreated, { template: templateOf(input.template) })))
      })

      const owned = Effect.fn("AgentStore.owned")(function*(owner: Owner, id: AgentId) {
        const [row] = yield* db.select().from(agents)
          .where(and(eq(agents.id, id as `agent_${string}`), eq(agents.userId, owner.id as `user_${string}`)))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "agent", id })
        return row
      })

      const get = Effect.fn("AgentStore.get")(function*(id: AgentRow["id"]) {
        const [row] = yield* db.select().from(agents).where(eq(agents.id, id)).pipe(Effect.orDie)
        return row
      })

      const tradingState = Effect.fn("AgentStore.tradingState")(function*(id: string) {
        const agent = yield* get(id as AgentRow["id"])
        const current = agent?.currentSessionId == null ? undefined : yield* sessions.get(agent.currentSessionId)
        const session = current?.status === "active" ? current : undefined
        return { agent, session, canTrade: agent?.status === "active" && !agent.paused && session !== undefined }
      })

      const list = Effect.fn("AgentStore.list")(function*(owner: Owner) {
        const rows = yield* db.select().from(agents)
          .where(and(eq(agents.userId, owner.id as `user_${string}`), ne(agents.status, "removed")))
          .orderBy(asc(agents.createdAt)).pipe(Effect.orDie)
        const all = yield* sessions.ofAgents(rows.map((row) => row.id))
        return rows.map((row) => toAgent(row, all.filter((session) => session.agentId === row.id)))
      })

      const running = Effect.fn("AgentStore.running")(function*(owner: Owner, paused: boolean) {
        return yield* db.select().from(agents).where(and(
          eq(agents.userId, owner.id as `user_${string}`),
          inArray(agents.status, ["locking", "active", "updating", "removing"]),
          eq(agents.paused, paused)
        )).pipe(Effect.orDie)
      })

      const pastEnd = Effect.fn("AgentStore.pastEnd")(function*(now: DateTime.Utc, userId?: UserId | undefined) {
        const rows = yield* db.select({ agent: agents }).from(agents)
          .innerJoin(agentSessions, eq(agentSessions.id, agents.currentSessionId))
          .where(and(
            eq(agents.status, "active"),
            lt(agentSessions.validUntil, now),
            userId === undefined ? undefined : eq(agents.userId, userId as `user_${string}`)
          )).pipe(Effect.orDie)
        return rows.map(({ agent }) => agent)
      })

      const inFlight = db.select().from(agents).where(inArray(agents.status, ["locking", "updating", "removing"])).pipe(
        Effect.orDie
      )

      const agentOf = Effect.fn("AgentStore.toAgent")(function*(row: AgentRow) {
        return toAgent(row, yield* sessions.ofAgents([row.id]))
      })

      // The agents' metrics for a move from `row` to `updated`: a lock that landed or failed, or a change of life.
      const measure = Effect.fnUntraced(function*(row: AgentRow, updated: AgentRow, change: string | undefined) {
        const template = templateOf(row.templateId)
        if (row.status === "locking" && updated.status !== "locking") {
          yield* count(AgentsLocked, { template, outcome: updated.status === "active" ? "locked" : "failed" })
        }
        const lifecycle = updated.paused !== row.paused
          ? (updated.paused ? "paused" : "resumed")
          : change === "renewed"
          ? "renewed"
          : updated.status === row.status
          ? undefined
          : updated.status === "removed" || updated.status === "expired"
          ? updated.status
          : row.status === "updating" && updated.status === "active"
          ? "changed"
          : undefined
        if (lifecycle !== undefined) yield* count(AgentsLifecycle, { change: lifecycle })
      })

      const save = Effect.fn("AgentStore.save")(function*(
        row: AgentRow,
        changes: Partial<AgentRow>,
        change?: "paused" | "renewed" | undefined
      ) {
        const now = yield* DateTime.now
        // A change notifications tell is written to their outbox in the change's transaction.
        const { agent, updated } = yield* db.transaction(() =>
          Effect.gen(function*() {
            const [updated] = yield* db.update(agents).set({ ...changes, updatedAt: now })
              .where(eq(agents.id, row.id)).returning()
            const agent = yield* agentOf(updated!)
            if (change !== undefined) {
              yield* outbox.write(LiveEvent.cases.AgentChanged.make({ agent, change }), row.userId as UserId)
            }
            return { agent, updated }
          })
        ).pipe(Effect.orDie)
        // Pauses, resumes and each step of a lock, change, renewal or removal. Landing (active, removed) and an end
        // (expired) are bluechip following the chain; the rest is you.
        const action = changes.paused !== undefined && changes.paused !== row.paused ?
          (changes.paused ? "agent.paused" : "agent.resumed") :
          changes.status !== undefined && changes.status !== row.status ?
          `agent.${changes.status}` :
          undefined
        yield* measure(row, updated!, change)
        if (action !== undefined) {
          const byBluechip = action === "agent.active" || action === "agent.removed" || action === "agent.expired"
          yield* audit.record({
            userId: row.userId as UserId,
            actor: byBluechip ? "system" : "owner",
            action,
            subjectType: "agent",
            subjectId: row.id,
            agentId: row.id,
            data: { name: updated!.name }
          })
        }
        yield* live.publish(
          LiveEvent.cases.AgentChanged.make(change === undefined ? { agent } : { agent, change }),
          row.userId as UserId
        )
        return agent
      })

      return AgentStore.of({
        create,
        owned,
        get,
        tradingState,
        list,
        running,
        pastEnd,
        inFlight,
        toAgent: agentOf,
        save
      })
    })
  )
}
