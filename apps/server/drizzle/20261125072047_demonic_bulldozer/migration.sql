CREATE TABLE "accounts" (
	"user_id" uuid PRIMARY KEY,
	"address" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone NOT NULL,
	"deployed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" uuid PRIMARY KEY,
	"purpose" text NOT NULL,
	"challenge" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY,
	"task" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"detail" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL UNIQUE,
	"cose_key" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"transports" text[] NOT NULL,
	"label" text,
	"synced" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"user_id" uuid,
	"at" timestamp with time zone,
	"value" numeric(78,0) NOT NULL,
	"cash" numeric(78,0) NOT NULL,
	CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY("user_id","at")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"passkey_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signing_requests" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"request_id" text NOT NULL,
	"withdrawal" jsonb NOT NULL,
	"user_operation" jsonb NOT NULL,
	"hash" text NOT NULL,
	"deploys_account" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"asset" text NOT NULL,
	"amount" numeric(78,0) NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"status" text NOT NULL,
	"user_op_hash" text,
	"tx_hash" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"display_name" text,
	"eligibility" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "job_runs_task_started_at_idx" ON "job_runs" ("task","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_requests_user_request_idx" ON "signing_requests" ("user_id","request_id");--> statement-breakpoint
CREATE INDEX "transfers_user_created_at_idx" ON "transfers" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_passkey_id_passkeys_id_fkey" FOREIGN KEY ("passkey_id") REFERENCES "passkeys"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;