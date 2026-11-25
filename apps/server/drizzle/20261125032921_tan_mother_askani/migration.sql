CREATE TABLE "idempotency_keys" (
	"user_id" text,
	"endpoint" text,
	"request_id" text,
	"fingerprint" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY("user_id","endpoint","request_id")
);
