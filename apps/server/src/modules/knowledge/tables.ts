import { sql } from "drizzle-orm"
import { index, integer, pgTable, text, uniqueIndex, vector } from "drizzle-orm/pg-core"
import { dateTimeUtc, tsvector, typeId } from "../../platform/db/columns.ts"
import { DIMENSIONS } from "../../platform/embeddings/Embeddings.ts"

/**
 * bluechip's knowledge, the same for everyone: help articles (`help`, from `content/help/`) and each stock's facts
 * (`stock`, from the chain package's stock list), by slug, with a hash of their content so an unchanged document is
 * left as it is.
 */
export const documents = pgTable("documents", {
  id: typeId("document")("id").primaryKey(),
  kind: text("kind", { enum: ["help", "stock"] }).notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  hash: text("hash").notNull(),
  updatedAt: dateTimeUtc("updated_at").notNull()
})

/**
 * A document's passages, one per section, with their vector (and the model that made it, `null` until embedded) and
 * their words for full-text search, the heading's counting most (a question naming a section finds it before a
 * neighbour that only shares its words). A few hundred passages: searched exactly, with no approximate vector index.
 */
export const chunks = pgTable("chunks", {
  id: typeId("chunk")("id").primaryKey(),
  documentId: typeId("document")("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  section: text("section"),
  text: text("text").notNull(),
  model: text("model"),
  embedding: vector("embedding", { dimensions: DIMENSIONS }),
  textSearch: tsvector("text_search").generatedAlwaysAs(
    sql`setweight(to_tsvector('english', coalesce(section, '')), 'A') || to_tsvector('english', text)`
  )
}, (table) => [
  uniqueIndex("chunks_document_position_idx").on(table.documentId, table.position),
  index("chunks_text_search_idx").using("gin", table.textSearch)
])
