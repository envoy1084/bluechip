CREATE TABLE "recovery_keys" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"passkey_id" uuid NOT NULL,
	"guard_address" text NOT NULL,
	"guard_key" text NOT NULL,
	"status" text NOT NULL,
	"user_op_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recovery_requests" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"recovery_key_id" uuid NOT NULL,
	"new_passkey_id" uuid NOT NULL,
	"calls" jsonb NOT NULL,
	"status" text NOT NULL,
	"signing" text,
	"user_operation" jsonb,
	"hash" text,
	"signing_expires_at" timestamp with time zone,
	"user_op_hash" text,
	"requested_at" timestamp with time zone NOT NULL,
	"executable_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_from" text,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "passkeys" ADD COLUMN "role" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "passkeys" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "passkeys" ADD COLUMN "user_op_hash" text;--> statement-breakpoint
ALTER TABLE "passkeys" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "scope" text DEFAULT 'account' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "device" text DEFAULT 'A browser' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "audit_events_user_agent_idx" ON "audit_events" ("user_id","agent_id");--> statement-breakpoint
ALTER TABLE "recovery_keys" ADD CONSTRAINT "recovery_keys_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recovery_keys" ADD CONSTRAINT "recovery_keys_passkey_id_passkeys_id_fkey" FOREIGN KEY ("passkey_id") REFERENCES "passkeys"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_recovery_key_id_recovery_keys_id_fkey" FOREIGN KEY ("recovery_key_id") REFERENCES "recovery_keys"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_new_passkey_id_passkeys_id_fkey" FOREIGN KEY ("new_passkey_id") REFERENCES "passkeys"("id") ON DELETE CASCADE;