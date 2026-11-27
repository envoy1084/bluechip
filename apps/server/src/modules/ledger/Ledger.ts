import { ChainClient } from "@bluechip/chain/ChainClient"
import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { poolAbi } from "@bluechip/chain/market/Aerodrome"
import type { AgentId, UserId } from "@bluechip/domain/Ids"
import { poolFee, slippage } from "@bluechip/domain/ledger/Costs"
import { dailyRows, dayOf } from "@bluechip/domain/ledger/Daily"
import { type LotEntry, replay, unrealised } from "@bluechip/domain/ledger/Lots"
import type { MarketPrice, StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { HeldLot } from "@bluechip/domain/performance/Performance"
import { and, asc, eq, gt, gte, isNull, lt, ne, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import type { Receipt } from "../signing/OwnerOperations.ts"
import { trades } from "../trading/tables.ts"
import { ledgerAdjustments, lotClosings, lots, pnlDaily } from "./tables.ts"

type TradeRow = typeof trades.$inferSelect

const zero = BigInt(0)

const dayBounds = (day: string) => {
  const start = DateTime.makeUnsafe(`${day}T00:00:00Z`)
  return { start, end: DateTime.add(start, { days: 1 }) }
}

/**
 * The ledger: each fill's costs (the pool's fee, slippage against Chainlink, gas), the lots each stock was bought in
 * and what each sale realised (FIFO, rebuilt from the fills and adjustments of that stock whenever one lands), and the
 * daily rows per stock and agent that performance reads.
 */
export class Ledger extends Context.Service<Ledger, {
  /** Records a filled trade: its costs, then its stock's lots and the day's rows. */
  readonly recordFill: (trade: TradeRow, gas: Receipt["gas"] | undefined) => Effect.Effect<void>
  /** Rebuilds one stock's lots and closings for a user from its fills and adjustments, and the days they touch. */
  readonly rebuild: (userId: UserId, symbol: string) => Effect.Effect<void>
  /**
   * Brings the ledger up to date with every fill: costs for filled trades without them, and lots for the stocks of
   * fills no lot or closing has seen (fills from before the ledger, or one whose rebuild was cut off). Returns how
   * many stocks it rebuilt.
   */
  readonly repair: Effect.Effect<{ readonly rebuilt: number }>
  /** The user's lots still held (of one stock, or every one), oldest first. */
  readonly openLots: (userId: UserId, symbol?: StockSymbol) => Effect.Effect<ReadonlyArray<HeldLot>>
  /** Writes today's unrealised profit of every open lot, per user, stock and agent, at `prices`. */
  readonly measure: (prices: ReadonlyMap<StockSymbol, MarketPrice>) => Effect.Effect<void>
}>()("@bluechip/server/Ledger") {
  static readonly layer = Layer.effect(
    Ledger,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const { stocks } = yield* ChainDeployment

      // The pool's fee now, in pips; `undefined` when it can't be read (the fill keeps no fee until a repair).
      const feePips = (symbol: string) => {
        const pool = stocks.find((stock) => stock.symbol === symbol)?.pool
        if (pool == null) return Effect.succeed(undefined)
        return chain.use(
          "pool fee",
          (client) => client.readContract({ address: pool.address, abi: poolAbi, functionName: "fee" })
        ).pipe(
          Effect.map(Number),
          Effect.catch((error) =>
            Effect.as(Effect.logWarning(`The ${symbol} pool's fee couldn't be read`, error), undefined)
          )
        )
      }

      const recordCosts = Effect.fnUntraced(function*(trade: TradeRow, gas: Receipt["gas"] | undefined) {
        const pips = yield* feePips(trade.symbol)
        const fee = pips === undefined ? undefined : poolFee(trade.side, Usdc.make(trade.usdc), pips)
        yield* db.update(trades).set({
          ...(fee === undefined ? {} : {
            fee,
            slippage: slippage({
              side: trade.side,
              usdc: Usdc.make(trade.usdc),
              shares: Shares.make(trade.shares),
              reference: Price.make(trade.reference),
              fee
            })
          }),
          ...(gas === undefined ? {} : { gasWei: gas.wei, gasPaidBy: gas.paidBy })
        }).where(eq(trades.id, trade.id)).pipe(Effect.orDie)
      })

      const refreshDay = Effect.fnUntraced(function*(userId: UserId, day: string) {
        const { end, start } = dayBounds(day)
        const user = userId as `user_${string}`
        const filled = yield* db.select().from(trades).where(and(
          eq(trades.userId, user),
          eq(trades.status, "filled"),
          gte(trades.settledAt, start),
          lt(trades.settledAt, end)
        )).pipe(Effect.orDie)
        const closed = yield* db.select().from(lotClosings).where(and(
          eq(lotClosings.userId, user),
          gte(lotClosings.closedAt, start),
          lt(lotClosings.closedAt, end)
        )).pipe(Effect.orDie)

        const rows = dailyRows(
          filled.map((trade) => ({
            day,
            symbol: trade.symbol,
            agentId: trade.agentId,
            fee: trade.fee ?? zero,
            slippage: trade.slippage ?? zero,
            gasWei: trade.gasWei ?? zero
          })),
          closed.map((closing) => ({
            day,
            symbol: closing.symbol,
            agentId: closing.agentId,
            realised: closing.realised
          }))
        )

        // Rows of the day nothing fills any more keep their unrealised measurement and lose the rest.
        yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.update(pnlDaily).set({ realised: zero, fees: zero, slippage: zero, gasWei: zero, trades: 0 })
              .where(and(eq(pnlDaily.userId, user), eq(pnlDaily.day, day)))
            for (const row of rows) {
              const values = {
                realised: row.realised,
                fees: row.fees,
                slippage: row.slippage,
                gasWei: row.gasWei,
                trades: row.trades
              }
              yield* tx.insert(pnlDaily).values({
                userId: user,
                day,
                symbol: row.symbol,
                agentId: row.agentId as `agent_${string}` | null,
                unrealised: null,
                ...values
              }).onConflictDoUpdate({
                target: [pnlDaily.userId, pnlDaily.day, pnlDaily.symbol, pnlDaily.agentId],
                set: values
              })
            }
          })
        ).pipe(Effect.orDie)
      })

      const rebuild = Effect.fn("Ledger.rebuild")(function*(userId: UserId, symbol: string) {
        const user = userId as `user_${string}`

        const days = yield* db.transaction((tx) =>
          Effect.gen(function*() {
            // One rebuild of a stock at a time: a fill and a reconciliation can land together.
            yield* tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ledger:${userId}:${symbol}`}))`)

            const fills = yield* tx.select().from(trades)
              .where(and(eq(trades.userId, user), eq(trades.symbol, symbol), eq(trades.status, "filled")))
            const adjustments = yield* tx.select().from(ledgerAdjustments)
              .where(and(eq(ledgerAdjustments.userId, user), eq(ledgerAdjustments.asset, symbol)))
            const before = yield* tx.select({ closedAt: lotClosings.closedAt }).from(lotClosings)
              .where(and(eq(lotClosings.userId, user), eq(lotClosings.symbol, symbol)))

            const entries: Array<LotEntry & { readonly order: string }> = [
              ...fills.map((trade): LotEntry & { readonly order: string } => {
                const at = DateTime.toEpochMillis(trade.settledAt ?? trade.createdAt)
                const base = { source: trade.id, agentId: trade.agentId, at, flagged: false, order: trade.id }
                return trade.side === "buy" ?
                  { ...base, _tag: "Open", shares: Shares.make(trade.shares), cost: Usdc.make(trade.usdc) } :
                  { ...base, _tag: "Close", shares: Shares.make(trade.shares), proceeds: Usdc.make(trade.usdc) }
              }),
              ...adjustments.map((adjustment): LotEntry & { readonly order: string } => {
                const base = {
                  source: adjustment.id,
                  agentId: null,
                  at: DateTime.toEpochMillis(adjustment.at),
                  flagged: true,
                  order: adjustment.id
                }
                const value = Usdc.make(adjustment.value < zero ? -adjustment.value : adjustment.value)
                return adjustment.amount >= zero ?
                  { ...base, _tag: "Open", shares: Shares.make(adjustment.amount), cost: value } :
                  { ...base, _tag: "Close", shares: Shares.make(-adjustment.amount), proceeds: value }
              })
            ].sort((a, b) => a.at - b.at || (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
            const { closings, lots: replayed } = replay(entries)

            yield* tx.delete(lots).where(and(eq(lots.userId, user), eq(lots.symbol, symbol)))
            yield* tx.delete(lotClosings).where(and(eq(lotClosings.userId, user), eq(lotClosings.symbol, symbol)))

            const ids = new Map(replayed.map((lot) => [lot.source, typeid("lot").toString() as `lot_${string}`]))
            const sourceOf = (source: string) =>
              source.startsWith("trade_") ?
                { tradeId: source as `trade_${string}`, adjustmentId: null } :
                { tradeId: null, adjustmentId: source as `adjustment_${string}` }
            const at = (millis: number) => DateTime.makeUnsafe(millis)

            if (replayed.length > 0) {
              yield* tx.insert(lots).values(replayed.map((lot) => ({
                id: ids.get(lot.source)!,
                userId: user,
                symbol,
                agentId: lot.agentId as `agent_${string}` | null,
                ...sourceOf(lot.source),
                shares: lot.shares,
                cost: lot.cost,
                remaining: lot.remaining,
                remainingCost: lot.remainingCost,
                openedAt: at(lot.openedAt),
                closedAt: lot.closedAt === null ? null : at(lot.closedAt),
                flagged: lot.flagged
              })))
            }
            if (closings.length > 0) {
              yield* tx.insert(lotClosings).values(closings.map((closing) => ({
                id: typeid("closing").toString() as `closing_${string}`,
                userId: user,
                symbol,
                lotId: closing.lot === null ? null : ids.get(closing.lot)!,
                ...sourceOf(closing.source),
                agentId: closing.agentId as `agent_${string}` | null,
                shares: closing.shares,
                cost: closing.cost,
                proceeds: closing.proceeds,
                realised: closing.realised,
                closedAt: at(closing.at),
                flagged: closing.flagged
              })))
            }

            return new Set([
              ...before.map((closing) => dayOf(closing.closedAt)),
              ...closings.map((closing) => dayOf(at(closing.at))),
              ...fills.map((trade) => dayOf(trade.settledAt ?? trade.createdAt))
            ])
          })
        ).pipe(Effect.orDie)

        for (const day of days) yield* refreshDay(userId, day)
      })

      const recordFill = Effect.fn("Ledger.recordFill")(function*(trade: TradeRow, gas: Receipt["gas"] | undefined) {
        if (trade.status !== "filled") return
        yield* recordCosts(trade, gas)
        yield* rebuild(trade.userId as UserId, trade.symbol)
      })

      const repair = Effect.gen(function*() {
        const costless = yield* db.select().from(trades)
          .where(and(eq(trades.status, "filled"), isNull(trades.fee))).pipe(Effect.orDie)
        for (const trade of costless) yield* recordCosts(trade, undefined)

        const unseen = yield* db.selectDistinct({ userId: trades.userId, symbol: trades.symbol }).from(trades)
          .where(and(
            eq(trades.status, "filled"),
            sql`not exists (select 1 from ${lots} where ${lots.tradeId} = ${trades.id})`,
            sql`not exists (select 1 from ${lotClosings} where ${lotClosings.tradeId} = ${trades.id})`
          )).pipe(Effect.orDie)
        for (const pair of unseen) yield* rebuild(pair.userId as UserId, pair.symbol)
        return { rebuilt: unseen.length }
      }).pipe(Effect.withSpan("Ledger.repair"))

      const measure = Effect.fn("Ledger.measure")(function*(prices: ReadonlyMap<StockSymbol, MarketPrice>) {
        const day = dayOf(yield* DateTime.now)
        const open = yield* db.select().from(lots).where(gt(lots.remaining, zero)).pipe(Effect.orDie)

        const groups = new Map<string, { userId: string; symbol: string; agentId: string | null; value: bigint }>()
        for (const lot of open) {
          const price = prices.get(lot.symbol as StockSymbol)
          if (price === undefined) continue
          const key = `${lot.userId}|${lot.symbol}|${lot.agentId ?? ""}`
          const group = groups.get(key) ?? { userId: lot.userId, symbol: lot.symbol, agentId: lot.agentId, value: zero }
          groups.set(key, {
            ...group,
            value: group.value +
              unrealised(
                [{ remaining: Shares.make(lot.remaining), remainingCost: Usdc.make(lot.remainingCost) }],
                price.price
              )
          })
        }

        // A stock sold out since the last measurement is measured at nothing.
        yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.update(pnlDaily).set({ unrealised: zero })
              .where(and(eq(pnlDaily.day, day), ne(pnlDaily.unrealised, zero)))
            for (const group of groups.values()) {
              yield* tx.insert(pnlDaily).values({
                userId: group.userId as `user_${string}`,
                day,
                symbol: group.symbol,
                agentId: group.agentId as `agent_${string}` | null,
                realised: zero,
                unrealised: group.value,
                fees: zero,
                slippage: zero,
                gasWei: zero,
                trades: 0
              }).onConflictDoUpdate({
                target: [pnlDaily.userId, pnlDaily.day, pnlDaily.symbol, pnlDaily.agentId],
                set: { unrealised: group.value }
              })
            }
          })
        ).pipe(Effect.orDie)
      })

      const openLots = Effect.fn("Ledger.openLots")(function*(userId: UserId, symbol?: StockSymbol) {
        const rows = yield* db.select().from(lots).where(and(
          eq(lots.userId, userId as `user_${string}`),
          gt(lots.remaining, zero),
          symbol === undefined ? undefined : eq(lots.symbol, symbol)
        )).orderBy(asc(lots.openedAt), asc(lots.id)).pipe(Effect.orDie)
        return rows.map((row) =>
          new HeldLot({
            symbol: row.symbol as StockSymbol,
            agentId: row.agentId as AgentId | null,
            shares: Shares.make(row.shares),
            cost: Usdc.make(row.cost),
            remaining: Shares.make(row.remaining),
            remainingCost: Usdc.make(row.remainingCost),
            openedAt: row.openedAt,
            flagged: row.flagged
          })
        )
      })

      return Ledger.of({ recordFill, rebuild, repair, openLots, measure })
    })
  )

  /** Repairs the ledger once at startup, in the background: backfills fills from before the ledger. */
  static readonly repairOnStart = Layer.effectDiscard(Effect.forkScoped(Ledger.use((ledger) => ledger.repair)))
}
