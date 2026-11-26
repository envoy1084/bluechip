CREATE TABLE "reconciliation_cursors" (
	"user_id" uuid PRIMARY KEY,
	"block_number" numeric(78,0) NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reconciliation_cursors" ADD CONSTRAINT "reconciliation_cursors_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;