import type { AgentId, UserId } from "@bluechip/domain/Ids"
import {
  digestOf,
  notificationOfExpiring,
  notificationOfSessionEnding,
  notificationOfWaiting
} from "@bluechip/domain/notifications/Drafts"
import { and, between, eq, gte, inArray, isNotNull, lt, or } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "../../platform/db/Database.ts"
import { agents, agentSessions } from "../agents/tables.ts"
import { toIntent } from "../intents/IntentStore.ts"
import { intents } from "../intents/tables.ts"
import { stockName } from "./Fanout.ts"
import { Notifications } from "./Notifications.ts"
import { notifications as notificationsTable } from "./tables.ts"

// An agent's trade waiting this long is worth telling; an approval this close to its end is worth a reminder.
const WAITING_HOURS = 1
const EXPIRING_HOURS = 1

/**
 * The notifications time makes: an agent's trade still waiting after an hour, an approval expiring within the hour,
 * an agent's session ending in 7 days and in 1 day (each once: their keys dedupe), and each user's daily digest of
 * the kinds they hold back for it.
 */
export class Reminders extends Context.Service<Reminders, {
  /** Everyone's reminders (the cron), or one user's. */
  readonly remind: (options?: { readonly userId?: UserId | undefined }) => Effect.Effect<void>
  /** Each user's digest of the last 24 hours (everyone's, or one user's): what the kinds they hold back held. */
  readonly digest: (options?: { readonly userId?: UserId | undefined }) => Effect.Effect<void>
}>()("@bluechip/server/Reminders") {
  static readonly layer = Layer.effect(
    Reminders,
    Effect.gen(function*() {
      const db = yield* Database
      const notifications = yield* Notifications

      const agentName = Effect.fnUntraced(function*(agentId: string | null) {
        if (agentId === null) return null
        const [row] = yield* db.select({ name: agents.name }).from(agents)
          .where(eq(agents.id, agentId as `agent_${string}`)).pipe(Effect.orDie)
        return row?.name ?? null
      })

      const remind = Effect.fn("Reminders.remind")(function*(options: { readonly userId?: UserId | undefined } = {}) {
        const now = yield* DateTime.now
        const ofUser = <C extends typeof intents.userId | typeof agents.userId>(column: C) =>
          options.userId === undefined ? undefined : eq(column, options.userId as `user_${string}`)

        const waiting = yield* db.select().from(intents).where(and(
          eq(intents.status, "waiting"),
          isNotNull(intents.agentId),
          ofUser(intents.userId),
          lt(intents.createdAt, DateTime.subtract(now, { hours: WAITING_HOURS }))
        )).pipe(Effect.orDie)
        for (const row of waiting) {
          const names = { agent: yield* agentName(row.agentId), stock: stockName }
          yield* notifications.add(row.userId as UserId, notificationOfWaiting(toIntent(row), names))
        }

        const expiring = yield* db.select().from(intents).where(and(
          inArray(intents.status, ["needsApproval", "awaitingSignature"]),
          or(isNotNull(intents.agentId), eq(intents.source, "automation")),
          ofUser(intents.userId),
          between(intents.expiresAt, now, DateTime.add(now, { hours: EXPIRING_HOURS }))
        )).pipe(Effect.orDie)
        for (const row of expiring) {
          const names = { agent: yield* agentName(row.agentId), stock: stockName }
          yield* notifications.add(row.userId as UserId, notificationOfExpiring(toIntent(row), names))
        }

        const ending = yield* db.select({ agent: agents, session: agentSessions }).from(agents)
          .innerJoin(agentSessions, eq(agentSessions.id, agents.currentSessionId))
          .where(and(
            eq(agents.status, "active"),
            ofUser(agents.userId),
            between(agentSessions.validUntil, now, DateTime.add(now, { days: 7 }))
          )).pipe(Effect.orDie)
        for (const { agent, session } of ending) {
          const validUntil = session.validUntil!
          const days = DateTime.isLessThanOrEqualTo(validUntil, DateTime.add(now, { days: 1 })) ? 1 : 7
          yield* notifications.add(
            agent.userId as UserId,
            notificationOfSessionEnding({ id: agent.id as AgentId, name: agent.name }, {
              sessionId: session.id,
              validUntil,
              days
            })
          )
        }
      })

      const digest = Effect.fn("Reminders.digest")(function*(options: { readonly userId?: UserId | undefined } = {}) {
        const now = yield* DateTime.now
        const from = DateTime.subtract(now, { days: 1 })
        const day = DateTime.formatIsoDateUtc(now)
        const users = yield* db.selectDistinct({ userId: notificationsTable.userId }).from(notificationsTable)
          .where(and(
            gte(notificationsTable.createdAt, from),
            options.userId === undefined ? undefined : eq(notificationsTable.userId, options.userId as `user_${string}`)
          )).pipe(Effect.orDie)

        for (const { userId } of users) {
          const settings = yield* notifications.settings(userId as UserId)
          const held = new Set(settings.rules.filter((rule) => rule.digest).map((rule) => rule.kind))
          if (held.size === 0) continue
          const since = yield* notifications.since(userId as UserId, from)
          const draft = digestOf(day, since.filter((notification) => held.has(notification.kind)))
          if (draft !== undefined) yield* notifications.add(userId as UserId, draft)
        }
      })

      return Reminders.of({ remind, digest })
    })
  )
}
