import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { readPhases, readRounds } from "@bluechip/chain/market/Rounds"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { recordPrices } from "./History.ts"

// Rounds per multicall: big enough to keep the call count low, small enough for an RPC's response limits.
const BATCH = 200

/**
 * Stores every past answer of every stock's feed, across its aggregator upgrades (phases), newest first. Safe to run
 * again: stored answers are skipped. Returns the answers read per stock.
 */
export const backfillPrices = Effect.gen(function*() {
  const chain = yield* ChainClient
  const counts: Record<string, number> = {}
  for (const stock of stocks) {
    let total = 0
    for (const { lastRound, phase } of yield* readPhases(chain, stock.feed)) {
      for (let from = lastRound; from > BigInt(0); from -= BigInt(BATCH)) {
        const rounds = yield* readRounds(chain, stock.feed, { phase, fromRound: from, count: BATCH })
        yield* recordPrices(rounds.map((round) => ({
          symbol: stock.symbol as StockSymbol,
          at: DateTime.makeUnsafe(round.updatedAt),
          price: round.price
        })))
        total += rounds.length
      }
    }
    counts[stock.symbol] = total
    yield* Effect.logInfo(`Backfilled ${stock.symbol}`, { answers: total })
  }
  return counts
}).pipe(Effect.withSpan("market.backfillPrices"))
