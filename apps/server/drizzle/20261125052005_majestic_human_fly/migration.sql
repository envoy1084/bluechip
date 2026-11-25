CREATE TABLE "price_points" (
	"symbol" text,
	"at" timestamp with time zone,
	"price" numeric(78,0) NOT NULL,
	CONSTRAINT "price_points_pkey" PRIMARY KEY("symbol","at")
);
--> statement-breakpoint
CREATE INDEX "price_points_at_idx" ON "price_points" ("at");