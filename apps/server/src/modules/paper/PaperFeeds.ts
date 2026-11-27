import { ChainClient } from "@bluechip/chain/ChainClient"
import { readPrices } from "@bluechip/chain/market/Prices"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { type FeedAnswer, feedUpdates } from "@bluechip/domain/paper/FeedUpdates"
import * as Singleton from "effect/cluster/Singleton"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schedule from "effect/Schedule"
import { parseEther } from "viem"
import { marketStatus } from "../market/Calendar.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { Operator } from "./Operator.ts"

// Below this, the operator has a few days of feed writes left: time to top it up from a Sepolia faucet.
const LOW_ETH = parseEther("0.05")

/**
 * Paper money's price feeds, written from the market's prices on one runner of the cluster: every 15 seconds, the
 * feeds `feedUpdates` picks (moved 0.1% or an hour old, never while the market is paused) in one transaction, with a
 * warning when a write fails; and every 10 minutes a warning when the operator runs low on ETH. Only scheduled where
 * the deployment has paper money (with its `Operator`).
 */
export const PaperFeeds = Singleton.make(
  "paper.feeds",
  Effect.gen(function*() {
    const chain = yield* ChainClient
    const market = yield* MarketPrices
    const operator = Option.getOrThrowWith(
      yield* Effect.serviceOption(Operator),
      () => new Error("PaperFeeds: no operator on this network")
    )

    const push = Effect.gen(function*() {
      const now = yield* DateTime.now
      const { prices: answers } = yield* readPrices(chain)
      const feeds = new Map(answers.map((feed): [StockSymbol, FeedAnswer] => [
        feed.stock.symbol as StockSymbol,
        { answer: Price.make(feed.price), updatedAt: DateTime.makeUnsafe(feed.updatedAt) }
      ]))

      const updates = feedUpdates({
        session: marketStatus(now).session,
        now,
        prices: [...(yield* market.prices).values()],
        feeds
      })
      if (updates.length === 0) return

      const stocks = new Map(chain.deployment.stocks.map((stock) => [stock.symbol, stock.feed]))
      const hash = yield* operator.pushFeeds(
        updates.flatMap((update) => {
          const feed = stocks.get(update.symbol)
          return feed === undefined ? [] : [{ feed, answer: update.answer }]
        })
      )
      yield* Effect.logDebug("Paper feeds written", { symbols: updates.map((update) => update.symbol), hash })
    }).pipe(
      Effect.catchCause((cause) => Effect.logWarning("Paper feeds: the write failed", cause)),
      Effect.withSpan("PaperFeeds.push")
    )

    const checkBalance = operator.ethBalance.pipe(
      Effect.flatMap((balance) =>
        balance < LOW_ETH
          ? Effect.logWarning("Paper operator is low on ETH", { address: operator.address, wei: balance.toString() })
          : Effect.void
      ),
      Effect.catchCause((cause) => Effect.logWarning("Paper operator: could not read its ETH", cause))
    )

    yield* Effect.forkScoped(checkBalance.pipe(Effect.repeat(Schedule.spaced("10 minutes"))))
    return yield* push.pipe(Effect.repeat(Schedule.spaced("15 seconds")))
  })
)
