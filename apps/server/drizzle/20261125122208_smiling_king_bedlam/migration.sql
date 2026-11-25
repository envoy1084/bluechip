CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"status" text NOT NULL,
	"usdc" numeric(78,0) NOT NULL,
	"shares" numeric(78,0) NOT NULL,
	"price" numeric(78,0) NOT NULL,
	"reference" numeric(78,0) NOT NULL,
	"reference_status" text NOT NULL,
	"gap_bps" integer NOT NULL,
	"user_op_hash" text,
	"tx_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "signing_requests" ADD COLUMN "kind" text NOT NULL;--> statement-breakpoint
ALTER TABLE "signing_requests" ADD COLUMN "payload" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "signing_requests" DROP COLUMN "withdrawal";--> statement-breakpoint
CREATE INDEX "trades_user_created_at_idx" ON "trades" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;