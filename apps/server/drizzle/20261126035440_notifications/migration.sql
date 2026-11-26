CREATE TABLE "channel_link_codes" (
	"code_hash" text PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "channel_links" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_user_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"name" text,
	"conversation_id" uuid,
	"linked_at" timestamp with time zone NOT NULL,
	"unlinked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY,
	"notification_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"user_id" uuid,
	"kind" text,
	"channels" text[] NOT NULL,
	"digest" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notification_rules_pkey" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" uuid PRIMARY KEY,
	"quiet_hours" jsonb
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"subject_type" text,
	"subject_id" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "channel_link_codes_user_idx" ON "channel_link_codes" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_links_linked_chat_idx" ON "channel_links" ("platform","chat_id") WHERE unlinked_at is null;--> statement-breakpoint
CREATE INDEX "channel_links_user_idx" ON "channel_links" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_channel_idx" ON "notification_deliveries" ("notification_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_key_idx" ON "notifications" ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id","id");--> statement-breakpoint
ALTER TABLE "channel_link_codes" ADD CONSTRAINT "channel_link_codes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;