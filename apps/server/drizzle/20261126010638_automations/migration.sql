CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY,
	"automation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"window_key" text NOT NULL,
	"fired_at" timestamp with time zone NOT NULL,
	"trigger_data" jsonb NOT NULL,
	"conditions" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"reason" text NOT NULL,
	"intent_ids" text[] NOT NULL,
	"notification_id" text
);
--> statement-breakpoint
CREATE TABLE "automation_state" (
	"automation_id" uuid PRIMARY KEY,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"request_key" text NOT NULL,
	"name" text NOT NULL,
	"trigger" jsonb NOT NULL,
	"conditions" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"status" text NOT NULL,
	"next_run_at" timestamp with time zone,
	"fires" integer DEFAULT 0 NOT NULL,
	"last_fired_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_from" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judgments" (
	"id" uuid PRIMARY KEY,
	"run_id" uuid NOT NULL,
	"preset" text NOT NULL,
	"news_item_id" uuid,
	"headline" text NOT NULL,
	"model" text NOT NULL,
	"answer" jsonb NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" uuid PRIMARY KEY,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"symbols" text[] NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"url" text,
	"published_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "ask" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_automation_window_idx" ON "automation_runs" ("automation_id","window_key");--> statement-breakpoint
CREATE INDEX "automation_runs_automation_fired_at_idx" ON "automation_runs" ("automation_id","fired_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automations_user_request_key_idx" ON "automations" ("user_id","request_key");--> statement-breakpoint
CREATE INDEX "automations_user_created_at_idx" ON "automations" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "automations_status_next_run_at_idx" ON "automations" ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "judgments_run_idx" ON "judgments" ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_source_id_idx" ON "news_items" ("source","source_id");--> statement-breakpoint
CREATE INDEX "news_items_published_at_idx" ON "news_items" ("published_at");--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "automation_state" ADD CONSTRAINT "automation_state_automation_id_automations_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "judgments" ADD CONSTRAINT "judgments_run_id_automation_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "automation_runs"("id") ON DELETE CASCADE;