CREATE TABLE "faucet_grants" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"account" text NOT NULL,
	"amount" numeric(78,0) NOT NULL,
	"tx_hash" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "faucet_grants_user_created_at_idx" ON "faucet_grants" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "faucet_grants" ADD CONSTRAINT "faucet_grants_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;