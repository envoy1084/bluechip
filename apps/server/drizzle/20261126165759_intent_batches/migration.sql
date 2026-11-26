ALTER TABLE "intents" ADD COLUMN "batch_id" text;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "wave" integer;--> statement-breakpoint
CREATE INDEX "intents_batch_idx" ON "intents" ("batch_id","wave");