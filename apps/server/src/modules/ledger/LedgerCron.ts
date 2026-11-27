import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { Ledger } from "./Ledger.ts"

/**
 * Every hour: the ledger repaired (costs and lots any fill is missing), then every open lot's unrealised profit
 * written to today's rows at market prices. A run more than half an hour late is skipped.
 */
export const LedgerCron = measuredCron({
  name: "ledger.hourly",
  cron: Cron.parseUnsafe("5 * * * *"),
  execute: Effect.gen(function*() {
    const ledger = yield* Ledger
    const market = yield* MarketPrices

    yield* ledger.repair
    yield* ledger.measure(yield* market.prices)
  }).pipe(Effect.withSpan("LedgerCron")),
  skipIfOlderThan: Duration.minutes(30)
})
