import { Platform } from "@bluechip/domain/channels/Channel"
import { sql } from "drizzle-orm"
import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { dateTimeUtc, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { conversations } from "../assistant/tables.ts"

/**
 * Chats linked to users: the platform, the person (`external_user_id`) and chat (`chat_id`, the platform's address)
 * there, their name, the assistant conversation the chat continues, and when it was linked and unlinked. A chat is
 * linked to one user at a time.
 */
export const channelLinks = pgTable("channel_links", {
  id: typeId("channellink")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform", { enum: Platform.literals }).notNull(),
  externalUserId: text("external_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  name: text("name"),
  conversationId: typeId("conversation")("conversation_id").references(() => conversations.id, {
    onDelete: "set null"
  }),
  linkedAt: dateTimeUtc("linked_at").notNull(),
  unlinkedAt: dateTimeUtc("unlinked_at")
}, (table) => [
  uniqueIndex("channel_links_linked_chat_idx").on(table.platform, table.chatId).where(sql`unlinked_at is null`),
  index("channel_links_user_idx").on(table.userId)
])

/**
 * One-time codes linking a chat: stored as their SHA-256 (a code is a credential until it is used or expires), for
 * whom and which platform.
 */
export const channelLinkCodes = pgTable("channel_link_codes", {
  codeHash: text("code_hash").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform", { enum: Platform.literals }).notNull(),
  expiresAt: dateTimeUtc("expires_at").notNull(),
  usedAt: dateTimeUtc("used_at")
}, (table) => [index("channel_link_codes_user_idx").on(table.userId)])
