CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY,
	"agent_id" uuid NOT NULL,
	"spec" jsonb NOT NULL,
	"session_key" text NOT NULL,
	"permission_id" text,
	"grant" text,
	"valid_until" timestamp with time zone,
	"status" text NOT NULL,
	"user_op_hash" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"installed_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_templates" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"based_on" text,
	"spec" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_id" text,
	"status" text NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"current_session_id" uuid,
	"pending_session_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_keys" (
	"address" text PRIMARY KEY,
	"agent_id" uuid NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_policies" (
	"session_id" uuid,
	"position" integer,
	"policy" text NOT NULL,
	"config" jsonb NOT NULL,
	"kind" text NOT NULL,
	"contract" text NOT NULL,
	CONSTRAINT "session_policies_pkey" PRIMARY KEY("session_id","position")
);
--> statement-breakpoint
CREATE INDEX "agent_sessions_agent_created_at_idx" ON "agent_sessions" ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_templates_user_created_at_idx" ON "agent_templates" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agents_user_created_at_idx" ON "agents" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "session_policies_policy_idx" ON "session_policies" ("policy");--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent_templates" ADD CONSTRAINT "agent_templates_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_keys" ADD CONSTRAINT "session_keys_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_policies" ADD CONSTRAINT "session_policies_session_id_agent_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE;