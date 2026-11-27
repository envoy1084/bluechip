ALTER TABLE "chunks" DROP COLUMN "text_search";--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "text_search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(section, '')), 'A') || to_tsvector('english', text)) STORED;--> statement-breakpoint
CREATE INDEX "chunks_text_search_idx" ON "chunks" USING gin ("text_search");