import { sql } from "drizzle-orm"
import { doublePrecision, index, pgTable, primaryKey, text, vector } from "drizzle-orm/pg-core"
import { dateTimeUtc, tsvector, typeId } from "../../platform/db/columns.ts"
import { DIMENSIONS } from "../../platform/embeddings/Embeddings.ts"
import { users } from "../accounts/tables.ts"
import { agents } from "../agents/tables.ts"
import { conversations, messages } from "../assistant/tables.ts"
import { agentJournal } from "../journal/tables.ts"

/**
 * What the assistant remembers about each user: the fact, where it came from and how sure it was, the message it was
 * learned from, and when the user confirmed it (unconfirmed memories never reach a prompt).
 */
export const memories = pgTable("memories", {
  id: typeId("memory")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["preference", "constraint", "goal", "fact"] }).notNull(),
  text: text("text").notNull(),
  source: text("source", { enum: ["said", "inferred"] }).notNull(),
  confidence: doublePrecision("confidence").notNull(),
  note: text("note"),
  messageId: typeId("message")("message_id").references(() => messages.id, { onDelete: "set null" }),
  confirmedAt: dateTimeUtc("confirmed_at"),
  createdAt: dateTimeUtc("created_at").notNull(),
  lastUsedAt: dateTimeUtc("last_used_at")
}, (table) => [index("memories_user_created_at_idx").on(table.userId, table.createdAt)])

/**
 * A conversation's rolling summary: what was said up to `through_message_id`, written on the small model, so long
 * conversations send the summary and only the messages after it.
 */
export const conversationSummaries = pgTable("conversation_summaries", {
  id: typeId("summary")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: typeId("conversation")("conversation_id").notNull().unique()
    .references(() => conversations.id, { onDelete: "cascade" }),
  throughMessageId: typeId("message")("through_message_id").notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: dateTimeUtc("created_at").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
})

/**
 * Everything the assistant can recall for a user, one row per source (a memory, a message, a summary or a journal
 * entry, each a foreign key that deletes the row with its source): its text for full-text search and its vector, with
 * the model that made it (`null` until embedded; the embed job fills it and re-embeds after a change of model).
 */
export const recallEntries = pgTable("recall_entries", {
  id: typeId("recall")("id").primaryKey(),
  userId: typeId("user")("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: typeId("agent")("agent_id").references(() => agents.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["memory", "message", "summary", "journal"] }).notNull(),
  memoryId: typeId("memory")("memory_id").unique().references(() => memories.id, { onDelete: "cascade" }),
  messageId: typeId("message")("message_id").unique().references(() => messages.id, { onDelete: "cascade" }),
  summaryId: typeId("summary")("summary_id").unique()
    .references(() => conversationSummaries.id, { onDelete: "cascade" }),
  journalId: typeId("journal")("journal_id").unique().references(() => agentJournal.id, { onDelete: "cascade" }),
  /** The conversation a message or summary belongs to, so a turn doesn't recall its own conversation. */
  conversationId: typeId("conversation")("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  importance: doublePrecision("importance").notNull(),
  at: dateTimeUtc("at").notNull(),
  model: text("model"),
  embedding: vector("embedding", { dimensions: DIMENSIONS }),
  textSearch: tsvector("text_search").generatedAlwaysAs(sql`to_tsvector('english', text)`)
}, (table) => [
  index("recall_entries_user_kind_idx").on(table.userId, table.kind),
  index("recall_entries_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  index("recall_entries_text_search_idx").using("gin", table.textSearch)
])

/** Which memories were recalled for which turn (the user's message), for "used in 3 answers". */
export const memoryUses = pgTable("memory_uses", {
  memoryId: typeId("memory")("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
  messageId: typeId("message")("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  at: dateTimeUtc("at").notNull()
}, (table) => [primaryKey({ columns: [table.memoryId, table.messageId] })])
