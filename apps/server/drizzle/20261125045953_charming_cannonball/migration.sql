ALTER TABLE "passkeys" ADD COLUMN "synced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "passkey_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_passkey_id_passkeys_id_fkey" FOREIGN KEY ("passkey_id") REFERENCES "passkeys"("id") ON DELETE CASCADE;