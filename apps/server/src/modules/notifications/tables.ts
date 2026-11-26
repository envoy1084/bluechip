import { LiveEvent } from "@bluechip/domain/Events"
import { Channel, NotificationKind, QuietHours, Severity } from "@bluechip/domain/notifications/Notification"
import { boolean, index, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core"
import { dateTimeUtc, jsonbSchema, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"

/**
 * Each user's notification center: what happened (kind, severity, title and body), the page and record it is about,
 * and when it was read. `dedupe_key` makes one notification of what caused it, however often that is seen.
 */
export const notifications = pgTable("notifications", {
  id: typeId("notification")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: NotificationKind.literals }).notNull(),
  severity: text("severity", { enum: Severity.literals }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: dateTimeUtc("created_at").notNull(),
  readAt: dateTimeUtc("read_at")
}, (table) => [
  uniqueIndex("notifications_user_dedupe_key_idx").on(table.userId, table.dedupeKey),
  index("notifications_user_id_idx").on(table.userId, table.id)
])

/** The rules a user changed, one per kind (kinds without a row follow the catalog's defaults). */
export const notificationRules = pgTable("notification_rules", {
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: NotificationKind.literals }).notNull(),
  channels: text("channels", { enum: Channel.literals }).array().notNull(),
  digest: boolean("digest").notNull().default(false)
}, (table) => [primaryKey({ columns: [table.userId, table.kind] })])

/** A user's settings across kinds: quiet hours. */
export const notificationSettings = pgTable("notification_settings", {
  userId: typeId("user")("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  quietHours: jsonbSchema(QuietHours)("quiet_hours")
})

/**
 * Each notification's delivery on one channel beside the center: waiting (quiet hours, retries), sent, skipped (no
 * device or chat to send to) or failed after its retries, with why.
 */
export const notificationDeliveries = pgTable("notification_deliveries", {
  id: typeId("delivery")("id").primaryKey(),
  notificationId: typeId("notification")("notification_id").notNull()
    .references(() => notifications.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: ["push", "telegram"] }).notNull(),
  status: text("status", { enum: ["pending", "sent", "skipped", "failed"] }).notNull(),
  error: text("error"),
  at: dateTimeUtc("at").notNull()
}, (table) => [uniqueIndex("notification_deliveries_channel_idx").on(table.notificationId, table.channel)])

/**
 * The notifications' outbox: each live event that makes a notification, written in the transaction of the change it
 * tells, so a change is never stored without it. The fan-out turns each into its notification and deletes it; a row a
 * stopped process left (unclaimed, or claimed over a minute ago) is taken again, and the notification's `dedupe_key`
 * makes that harmless.
 */
export const notificationOutbox = pgTable("notification_outbox", {
  id: typeId("outbox")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  event: jsonbSchema(LiveEvent)("event").notNull(),
  createdAt: dateTimeUtc("created_at").notNull(),
  claimedAt: dateTimeUtc("claimed_at")
}, (table) => [index("notification_outbox_user_idx").on(table.userId, table.id)])
