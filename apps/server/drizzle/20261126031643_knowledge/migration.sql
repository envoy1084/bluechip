CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"section" text,
	"text" text NOT NULL,
	"model" text,
	"embedding" vector(1024),
	"text_search" tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY,
	"kind" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"hash" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_document_position_idx" ON "chunks" ("document_id","position");--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_text_search_idx" ON "chunks" USING gin ("text_search");--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;