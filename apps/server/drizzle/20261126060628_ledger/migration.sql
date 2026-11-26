CREATE TABLE "ledger_adjustments" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"asset" text NOT NULL,
	"reason" text NOT NULL,
	"amount" numeric(78,0) NOT NULL,
	"price" numeric(78,0),
	"value" numeric(78,0) NOT NULL,
	"block_number" numeric(78,0) NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lot_closings" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"lot_id" uuid,
	"trade_id" uuid,
	"adjustment_id" uuid,
	"agent_id" uuid,
	"shares" numeric(78,0) NOT NULL,
	"cost" numeric(78,0) NOT NULL,
	"proceeds" numeric(78,0) NOT NULL,
	"realised" numeric(78,0) NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"flagged" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"agent_id" uuid,
	"trade_id" uuid,
	"adjustment_id" uuid,
	"shares" numeric(78,0) NOT NULL,
	"cost" numeric(78,0) NOT NULL,
	"remaining" numeric(78,0) NOT NULL,
	"remaining_cost" numeric(78,0) NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"flagged" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pnl_daily" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"symbol" text NOT NULL,
	"agent_id" uuid,
	"realised" numeric(78,0) NOT NULL,
	"unrealised" numeric(78,0),
	"fees" numeric(78,0) NOT NULL,
	"slippage" numeric(78,0) NOT NULL,
	"gas_wei" numeric(78,0) NOT NULL,
	"trades" integer NOT NULL,
	CONSTRAINT "pnl_daily_user_day_symbol_agent_key" UNIQUE NULLS NOT DISTINCT("user_id","day","symbol","agent_id")
);
--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "fee" numeric(78,0);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "slippage" numeric(78,0);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "gas_wei" numeric(78,0);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "gas_paid_by" text;--> statement-breakpoint
CREATE INDEX "ledger_adjustments_user_asset_idx" ON "ledger_adjustments" ("user_id","asset");--> statement-breakpoint
CREATE INDEX "lot_closings_user_closed_at_idx" ON "lot_closings" ("user_id","closed_at");--> statement-breakpoint
CREATE INDEX "lots_user_symbol_idx" ON "lots" ("user_id","symbol");--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD CONSTRAINT "ledger_adjustments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lot_closings" ADD CONSTRAINT "lot_closings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lot_closings" ADD CONSTRAINT "lot_closings_lot_id_lots_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lot_closings" ADD CONSTRAINT "lot_closings_trade_id_trades_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lot_closings" ADD CONSTRAINT "lot_closings_adjustment_id_ledger_adjustments_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "ledger_adjustments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lot_closings" ADD CONSTRAINT "lot_closings_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_trade_id_trades_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_adjustment_id_ledger_adjustments_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "ledger_adjustments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pnl_daily" ADD CONSTRAINT "pnl_daily_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pnl_daily" ADD CONSTRAINT "pnl_daily_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;