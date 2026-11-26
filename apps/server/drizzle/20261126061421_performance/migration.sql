CREATE TABLE "drift_history" (
	"agent_id" uuid,
	"user_id" uuid NOT NULL,
	"at" timestamp with time zone,
	"drift_bps" integer NOT NULL,
	"trigger_bps" integer NOT NULL,
	CONSTRAINT "drift_history_pkey" PRIMARY KEY("agent_id","at")
);
--> statement-breakpoint
ALTER TABLE "drift_history" ADD CONSTRAINT "drift_history_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drift_history" ADD CONSTRAINT "drift_history_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;