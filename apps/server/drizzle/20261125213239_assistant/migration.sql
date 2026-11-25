CREATE TABLE "assistant_cards" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"card" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"surface" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"confidence" double precision NOT NULL,
	"note" text,
	"message_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_budgets" (
	"user_id" uuid,
	"day" date,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_budgets_pkey" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE INDEX "assistant_cards_user_idx" ON "assistant_cards" ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_user_updated_at_idx" ON "conversations" ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "memories_user_created_at_idx" ON "memories" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" ("conversation_id","created_at");--> statement-breakpoint
ALTER TABLE "assistant_cards" ADD CONSTRAINT "assistant_cards_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assistant_cards" ADD CONSTRAINT "assistant_cards_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_message_id_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_budgets" ADD CONSTRAINT "usage_budgets_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;