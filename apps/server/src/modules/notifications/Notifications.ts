import { NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { NotificationId, UserId } from "@bluechip/domain/Ids"
import { deliveryChannels, kindOf, KINDS, ruleFor } from "@bluechip/domain/notifications/Kinds"
import {
  type Channel,
  Notification,
  type NotificationDraft,
  type NotificationKind,
  NotificationSettings,
  type QuietHours
} from "@bluechip/domain/notifications/Notification"
import { and, count, desc, eq, gte, isNull, lt } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { count as countMetric, NotificationsCreated } from "../../platform/telemetry/Metrics.ts"
import { DeliverNotification } from "./DeliverNotification.ts"
import { notificationDeliveries, notificationRules, notifications, notificationSettings } from "./tables.ts"

type NotificationRow = typeof notifications.$inferSelect

/** A notification as the API returns it. */
export const toNotification = (row: NotificationRow) =>
  new Notification({
    id: row.id as NotificationId,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    body: row.body,
    link: row.link,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    createdAt: row.createdAt,
    readAt: row.readAt
  })

/**
 * Each user's notifications: features add them (from what happened, never sending anything themselves), the center
 * lists and reads them, and the rules say where each kind goes. Adding one stores it once per `dedupeKey`, tells the
 * user's open pages (`NotificationAdded`), and starts a delivery on each channel its rule picks, now or after the
 * digest.
 */
export class Notifications extends Context.Service<Notifications, {
  /** Stores a notification and starts its deliveries; `undefined` when it was added before. */
  readonly add: (userId: UserId, draft: NotificationDraft) => Effect.Effect<Notification | undefined>
  /** The user's notifications, newest first, a page at a time; `unread` for only those not read yet. */
  readonly list: (userId: UserId, query: {
    readonly pageSize?: number | undefined
    readonly pageToken?: string | undefined
    readonly unread?: boolean | undefined
  }) => Effect.Effect<{ readonly items: ReadonlyArray<Notification>; readonly nextPageToken: string | null }>
  readonly unreadCount: (userId: UserId) => Effect.Effect<number>
  /** Marks one as read (reading it again keeps the first time). */
  readonly read: (userId: UserId, id: string) => Effect.Effect<Notification, NotFound>
  readonly readAll: (userId: UserId) => Effect.Effect<void>
  /** The notifications made since `from`, oldest first: what a digest tells. */
  readonly since: (userId: UserId, from: DateTime.Utc) => Effect.Effect<ReadonlyArray<Notification>>
  /** The rule in force for every kind, and quiet hours. */
  readonly settings: (userId: UserId) => Effect.Effect<NotificationSettings>
  readonly setRule: (
    userId: UserId,
    kind: NotificationKind,
    rule: { readonly channels: ReadonlyArray<Channel>; readonly digest: boolean }
  ) => Effect.Effect<NotificationSettings>
  readonly setQuietHours: (userId: UserId, quietHours: QuietHours | null) => Effect.Effect<NotificationSettings>
}>()("@bluechip/server/Notifications") {
  static readonly layer = Layer.effect(
    Notifications,
    Effect.gen(function*() {
      const db = yield* Database
      const live = yield* LiveEvents
      const engine = yield* WorkflowEngine.WorkflowEngine

      const ofUser = (userId: UserId) => eq(notifications.userId, userId as `user_${string}`)

      const savedRule = Effect.fnUntraced(function*(userId: UserId, kind: NotificationKind) {
        const [row] = yield* db.select().from(notificationRules)
          .where(and(eq(notificationRules.userId, userId as `user_${string}`), eq(notificationRules.kind, kind)))
          .pipe(Effect.orDie)
        return ruleFor(kind, row)
      })

      const add = Effect.fn("Notifications.add")(function*(userId: UserId, draft: NotificationDraft) {
        const now = yield* DateTime.now
        const [row] = yield* db.insert(notifications).values({
          id: typeid("notification").toString() as `notification_${string}`,
          userId: userId as `user_${string}`,
          kind: draft.kind,
          severity: kindOf(draft.kind).severity,
          title: draft.title,
          body: draft.body,
          link: draft.link,
          subjectType: draft.subjectType,
          subjectId: draft.subjectId,
          dedupeKey: draft.dedupeKey,
          createdAt: now,
          readAt: null
        }).onConflictDoNothing().returning().pipe(Effect.orDie)
        if (row === undefined) return undefined
        yield* countMetric(NotificationsCreated, { kind: row.kind, severity: row.severity })

        // The deliveries are stored before anyone hears of it, so whoever does can follow them.
        const deliveries: Array<`delivery_${string}`> = []
        for (const channel of deliveryChannels(yield* savedRule(userId, draft.kind))) {
          const id = typeid("delivery").toString() as `delivery_${string}`
          yield* db.insert(notificationDeliveries).values({
            id,
            notificationId: row.id,
            channel,
            status: "pending",
            error: null,
            at: now
          }).pipe(Effect.orDie)
          deliveries.push(id)
        }

        const notification = toNotification(row)
        yield* live.publish(LiveEvent.cases.NotificationAdded.make({ notification }), userId)
        for (const deliveryId of deliveries) {
          yield* DeliverNotification.execute({ deliveryId }, { discard: true }).pipe(
            Effect.provideService(WorkflowEngine.WorkflowEngine, engine)
          )
        }
        return notification
      })

      const list = Effect.fn("Notifications.list")(function*(userId: UserId, query: {
        readonly pageSize?: number | undefined
        readonly pageToken?: string | undefined
        readonly unread?: boolean | undefined
      }) {
        const size = query.pageSize ?? 25
        const rows = yield* db.select().from(notifications).where(and(
          ofUser(userId),
          query.unread === true ? isNull(notifications.readAt) : undefined,
          query.pageToken === undefined ? undefined : lt(notifications.id, query.pageToken as `notification_${string}`)
        )).orderBy(desc(notifications.id)).limit(size + 1).pipe(Effect.orDie)

        const items = rows.slice(0, size).map(toNotification)
        return { items, nextPageToken: rows.length > size ? items.at(-1)!.id as string : null }
      })

      const unreadCount = Effect.fn("Notifications.unreadCount")(function*(userId: UserId) {
        const [row] = yield* db.select({ count: count() }).from(notifications)
          .where(and(ofUser(userId), isNull(notifications.readAt))).pipe(Effect.orDie)
        return row?.count ?? 0
      })

      const read = Effect.fn("Notifications.read")(function*(userId: UserId, id: string) {
        const byId = and(ofUser(userId), eq(notifications.id, id as `notification_${string}`))
        yield* db.update(notifications).set({ readAt: yield* DateTime.now })
          .where(and(byId, isNull(notifications.readAt))).pipe(Effect.orDie)
        const [row] = yield* db.select().from(notifications).where(byId).pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "notification", id })
        return toNotification(row)
      })

      const readAll = Effect.fn("Notifications.readAll")(function*(userId: UserId) {
        yield* db.update(notifications).set({ readAt: yield* DateTime.now })
          .where(and(ofUser(userId), isNull(notifications.readAt))).pipe(Effect.orDie)
      })

      const since = Effect.fn("Notifications.since")(function*(userId: UserId, from: DateTime.Utc) {
        const rows = yield* db.select().from(notifications)
          .where(and(ofUser(userId), gte(notifications.createdAt, from)))
          .orderBy(notifications.id).pipe(Effect.orDie)
        return rows.map(toNotification)
      })

      const settings = Effect.fn("Notifications.settings")(function*(userId: UserId) {
        const [rules, [stored]] = yield* Effect.all([
          db.select().from(notificationRules).where(eq(notificationRules.userId, userId as `user_${string}`)),
          db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId as `user_${string}`))
        ], { concurrency: 2 }).pipe(Effect.orDie)
        return new NotificationSettings({
          rules: KINDS.map((info) => ruleFor(info.kind, rules.find((rule) => rule.kind === info.kind))),
          quietHours: stored?.quietHours ?? null
        })
      })

      const setRule = Effect.fn("Notifications.setRule")(function*(
        userId: UserId,
        kind: NotificationKind,
        rule: { readonly channels: ReadonlyArray<Channel>; readonly digest: boolean }
      ) {
        const effective = ruleFor(kind, rule)
        const values = { channels: [...effective.channels], digest: effective.digest }
        yield* db.insert(notificationRules).values({ userId: userId as `user_${string}`, kind, ...values })
          .onConflictDoUpdate({ target: [notificationRules.userId, notificationRules.kind], set: values })
          .pipe(Effect.orDie)
        return yield* settings(userId)
      })

      const setQuietHours = Effect.fn("Notifications.setQuietHours")(
        function*(userId: UserId, quietHours: QuietHours | null) {
          yield* db.insert(notificationSettings).values({ userId: userId as `user_${string}`, quietHours })
            .onConflictDoUpdate({ target: notificationSettings.userId, set: { quietHours } }).pipe(Effect.orDie)
          return yield* settings(userId)
        }
      )

      return Notifications.of({ add, list, unreadCount, read, readAll, since, settings, setRule, setQuietHours })
    })
  )
}
