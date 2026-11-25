CREATE TABLE "agent_keys" (
	"agent_id" uuid PRIMARY KEY,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template" text NOT NULL,
	"status" text NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"limits" jsonb NOT NULL,
	"pending_limits" jsonb,
	"session_key" text NOT NULL,
	"locked_until" timestamp with time zone,
	"grant" text,
	"user_op_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agents_user_created_at_idx" ON "agents" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "agent_keys" ADD CONSTRAINT "agent_keys_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;