import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { readBalances } from "@bluechip/chain/funding/Balances"
import type { UserId } from "@bluechip/domain/Ids"
import type { MarketPrice, StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import { PortfolioPoint } from "@bluechip/domain/portfolio/Portfolio"
import { and, asc, eq, gte, lt } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Address } from "viem"
import { Database } from "../db/Database.ts"
import { accounts } from "../db/schema/accounts.ts"
import { portfolioSnapshots } from "../db/schema/portfolio.ts"
import { holdingsFrom } from "./AccountBalances.ts"
import { valueHoldings } from "./Valuation.ts"

const KEPT = { days: 30 }

/** Every portfolio's value over time, for the 30-day chart. */
export class PortfolioSnapshots extends Context.Service<PortfolioSnapshots, {
  /**
   * Records every user's portfolio value now (one balance read per 200 accounts, at the given market prices) and drops
   * snapshots older than 30 days; returns how many accounts it valued.
   */
  readonly record: (
    prices: ReadonlyMap<StockSymbol, MarketPrice>
  ) => Effect.Effect<{ readonly accounts: number }, ChainError>
  /** The user's snapshots from the last 30 days, oldest first. */
  readonly history: (userId: UserId) => Effect.Effect<ReadonlyArray<PortfolioPoint>>
}>()("@bluechip/server/PortfolioSnapshots") {
  static readonly layer = Layer.effect(
    PortfolioSnapshots,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient

      const record = Effect.fn("PortfolioSnapshots.record")(
        function*(prices: ReadonlyMap<StockSymbol, MarketPrice>) {
          const at = yield* DateTime.now
          const owners = yield* db.select({ userId: accounts.userId, address: accounts.address }).from(accounts)
            .pipe(Effect.orDie)

          if (owners.length > 0) {
            const { balances } = yield* readBalances(chain, owners.map((owner) => owner.address as Address))
            const rows = owners.map((owner) => {
              const portfolio = valueHoldings(holdingsFrom(balances.get(owner.address as Address)!), prices, at)
              return { userId: owner.userId, at, value: portfolio.value, cash: portfolio.cash }
            })
            yield* db.insert(portfolioSnapshots).values(rows).onConflictDoNothing().pipe(Effect.orDie)
          }

          yield* db.delete(portfolioSnapshots).where(lt(portfolioSnapshots.at, DateTime.subtract(at, KEPT))).pipe(
            Effect.orDie
          )
          return { accounts: owners.length }
        }
      )

      const history = Effect.fn("PortfolioSnapshots.history")(function*(userId: UserId) {
        const since = DateTime.subtract(yield* DateTime.now, KEPT)
        const rows = yield* db.select().from(portfolioSnapshots)
          .where(and(eq(portfolioSnapshots.userId, userId as `user_${string}`), gte(portfolioSnapshots.at, since)))
          .orderBy(asc(portfolioSnapshots.at))
          .pipe(Effect.orDie)
        return rows.map((row) => new PortfolioPoint({ at: row.at, value: Usdc.make(row.value) }))
      })

      return PortfolioSnapshots.of({ record, history })
    })
  )
}
