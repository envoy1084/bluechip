CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"event" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "notification_outbox_user_idx" ON "notification_outbox" ("user_id","id");--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;