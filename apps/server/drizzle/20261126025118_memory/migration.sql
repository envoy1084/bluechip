CREATE TABLE "agent_journal" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"entry" text NOT NULL,
	"refs" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_summaries" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL UNIQUE,
	"through_message_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_uses" (
	"memory_id" uuid,
	"message_id" uuid,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "memory_uses_pkey" PRIMARY KEY("memory_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "recall_entries" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"kind" text NOT NULL,
	"memory_id" uuid UNIQUE,
	"message_id" uuid UNIQUE,
	"summary_id" uuid UNIQUE,
	"journal_id" uuid UNIQUE,
	"conversation_id" uuid,
	"text" text NOT NULL,
	"importance" double precision NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"model" text,
	"embedding" vector(1024),
	"text_search" tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
--> statement-breakpoint
CREATE INDEX "agent_journal_agent_at_idx" ON "agent_journal" ("agent_id","at");--> statement-breakpoint
CREATE INDEX "recall_entries_user_kind_idx" ON "recall_entries" ("user_id","kind");--> statement-breakpoint
CREATE INDEX "recall_entries_embedding_idx" ON "recall_entries" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "recall_entries_text_search_idx" ON "recall_entries" USING gin ("text_search");--> statement-breakpoint
ALTER TABLE "agent_journal" ADD CONSTRAINT "agent_journal_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent_journal" ADD CONSTRAINT "agent_journal_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_through_message_id_messages_id_fkey" FOREIGN KEY ("through_message_id") REFERENCES "messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memory_uses" ADD CONSTRAINT "memory_uses_memory_id_memories_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memory_uses" ADD CONSTRAINT "memory_uses_message_id_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recall_entries" ADD CONSTRAINT "recall_entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recall_entries" ADD CONSTRAINT "recall_entries_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "recall_entries" ADD CONSTRAINT "recall_entries_memory_id_memories_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recall_entries" ADD CONSTRAINT "recall_entries_message_id_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recall_entries" ADD CONSTRAINT "recall_entries_summary_id_conversation_summaries_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "conversation_summaries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recall_entries" ADD CONSTRAINT "recall_entries_journal_id_agent_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "agent_journal"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recall_entries" ADD CONSTRAINT "recall_entries_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;