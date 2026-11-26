import { Card } from "@bluechip/domain/assistant/Card"
import { MessagePart, Surface } from "@bluechip/domain/assistant/Conversation"
import { bigint, date, index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core"
import * as Schema from "effect/Schema"
import { dateTimeUtc, jsonbSchema, typeId } from "../../platform/db/columns.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"

/** Conversations with the assistant: whose, the agent it is about, where it happens and its title. */
export const conversations = pgTable("conversations", {
  id: typeId("conversation")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "set null" }),
  surface: text("surface", { enum: Surface.literals }).notNull(),
  title: text("title"),
  createdAt: dateTimeUtc("created_at").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull(),
  archivedAt: dateTimeUtc("archived_at")
}, (table) => [index("conversations_user_updated_at_idx").on(table.userId, table.updatedAt)])

/**
 * Each message: the user's, or one model round of the assistant's, as typed parts (text, thinking, tool calls and
 * results, cards, errors), with the model and the tokens it used.
 */
export const messages = pgTable("messages", {
  id: typeId("message")("id").primaryKey(),
  conversationId: typeId("conversation")("conversation_id").notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  parts: jsonbSchema(Schema.Array(MessagePart))("parts").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  createdAt: dateTimeUtc("created_at").notNull()
}, (table) => [index("messages_conversation_created_at_idx").on(table.conversationId, table.createdAt)])

/**
 * The assistant's cards, as they stand now: messages keep the card they showed, and this row follows what you did with
 * it (confirmed, dismissed). `conversation_id` is `null` for cards made outside a conversation.
 */
export const assistantCards = pgTable("assistant_cards", {
  id: typeId("card")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: typeId("conversation")("conversation_id").references(() => conversations.id, {
    onDelete: "cascade"
  }),
  card: jsonbSchema(Card)("card").notNull(),
  createdAt: dateTimeUtc("created_at").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
}, (table) => [index("assistant_cards_user_idx").on(table.userId)])

/** Each user's assistant spend per UTC day: tokens and their cost in micro-dollars. */
export const usageBudgets = pgTable("usage_budgets", {
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day", { mode: "string" }).notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0)
}, (table) => [primaryKey({ columns: [table.userId, table.day] })])
