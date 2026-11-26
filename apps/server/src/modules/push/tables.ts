import { pgTable, text } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"

/**
 * Browsers that opted in to push, one row per device: its push service's endpoint, the keys messages are encrypted
 * for (`p256dh`, `auth`, base64url), and the device's name.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: typeId("pushsub")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  device: text("device").notNull(),
  createdAt: dateTimeUtc("created_at").notNull()
})
