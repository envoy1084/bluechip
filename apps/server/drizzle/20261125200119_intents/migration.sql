CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"session_id" uuid,
	"source" text NOT NULL,
	"source_id" text,
	"executor" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"leg" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"decision" jsonb,
	"signing_request_id" uuid,
	"user_op_hash" text,
	"trade_id" uuid,
	"retry_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "intent_id" uuid;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "source" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_events_user_at_idx" ON "audit_events" ("user_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "intents_user_dedupe_key_idx" ON "intents" ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "intents_user_created_at_idx" ON "intents" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "intents_agent_created_at_idx" ON "intents" ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "intents_status_idx" ON "intents" ("status");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "intents" ADD CONSTRAINT "intents_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "intents" ADD CONSTRAINT "intents_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_intent_id_intents_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "intents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;