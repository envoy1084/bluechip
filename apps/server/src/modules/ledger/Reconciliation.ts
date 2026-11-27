import { ChainClient } from "@bluechip/chain/ChainClient"
import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { assetsOf, readBalances } from "@bluechip/chain/funding/Balances"
import { fundedBucket, usdBucket } from "@bluechip/domain/analytics/Buckets"
import { LiveEvent } from "@bluechip/domain/Events"
import type { UserId } from "@bluechip/domain/Ids"
import { reconcile } from "@bluechip/domain/ledger/Reconcile"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, valueOf } from "@bluechip/domain/market/Units"
import { notificationOfAdjustment } from "@bluechip/domain/notifications/LedgerDrafts"
import { and, eq, gt, gte, inArray, or, sql, sum } from "drizzle-orm"
import * as Arr from "effect/Array"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { type Address, getAddress, parseAbiItem } from "viem"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import {
  count,
  Deposits,
  DepositsValue,
  ReconcileUnexplained,
  record as recordMetric,
  usd
} from "../../platform/telemetry/Metrics.ts"
import { accounts, users } from "../accounts/tables.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { transfers } from "../funding/tables.ts"
import { toTransfer } from "../funding/Transfers.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { NotificationOutbox } from "../notifications/Outbox.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { trades } from "../trading/tables.ts"
import { Ledger } from "./Ledger.ts"
import { ledgerAdjustments, lots, reconciliationCursors } from "./tables.ts"

const zero = BigInt(0)
const one = BigInt(1)

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)")

// A new account's first check looks this far back for deposits (about an hour of Base blocks); an older account's
// first check records its balances as they are.
const NEW_ACCOUNT = { hours: 1 }
const LOOKBACK_BLOCKS = BigInt(1_800)

// Providers cap a log query's range; Base makes a block every 2 seconds.
const LOG_RANGE = BigInt(2_000)

interface Deposit {
  readonly amount: bigint
  readonly from: Address
  readonly txHash: string
}

/**
 * Reconciliation: each account's balances on chain (USDC and every stock) against what its ledger expects. USDC sent
 * to an account from outside is recorded as a deposit (and tells its owner); any other difference becomes a flagged
 * ledger adjustment (a stock at the market price) and a `balanceUnexplained` notification. An account with a trade or
 * withdrawal on its way is left for the next round.
 */
export class Reconciliation extends Context.Service<Reconciliation, {
  /** Checks every account (or one user's); returns how many were checked and how many left for the next round. */
  readonly check: (options?: { readonly userId?: UserId | undefined }) => Effect.Effect<{
    readonly checked: number
    readonly skipped: number
  }>
}>()("@bluechip/server/Reconciliation") {
  static readonly layer = Layer.effect(
    Reconciliation,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const deployment = yield* ChainDeployment
      const { stocks, usdc } = deployment
      const assets = assetsOf(deployment)
      const market = yield* MarketPrices
      const ledger = yield* Ledger
      const analytics = yield* Analytics
      const live = yield* LiveEvents
      const outbox = yield* NotificationOutbox
      const balances = yield* AccountBalances

      // USDC transfers into `owners` in blocks `from`..`to`, by recipient.
      const depositLogs = Effect.fnUntraced(function*(owners: ReadonlyArray<Address>, from: bigint, to: bigint) {
        const found = new Map<string, Array<Deposit>>()
        for (const chunk of Arr.chunksOf(owners, 100)) {
          for (let start = from; start <= to; start += LOG_RANGE) {
            const end = start + LOG_RANGE - one < to ? start + LOG_RANGE - one : to
            const logs = yield* chain.use("read deposits", (client) =>
              client.getLogs({
                address: usdc,
                event: transferEvent,
                args: { to: [...chunk] },
                fromBlock: start,
                toBlock: end
              }))
            for (const log of logs) {
              const owner = log.args.to!.toLowerCase()
              found.set(owner, [
                ...(found.get(owner) ?? []),
                { amount: log.args.value!, from: log.args.from!, txHash: log.transactionHash }
              ])
            }
          }
        }
        return found
      })

      // The deposits told to analytics: each with whether it was the first, and the first one also as `first_funded`,
      // with what the person has put in overall as a range.
      const tellDeposits = Effect.fnUntraced(function*(
        userId: UserId,
        added: ReadonlyArray<typeof transfers.$inferSelect>
      ) {
        const [deposits, [user]] = yield* Effect.all([
          db.select({ id: transfers.id, amount: transfers.amount }).from(transfers)
            .where(and(eq(transfers.userId, userId as `user_${string}`), eq(transfers.kind, "deposit")))
            .orderBy(transfers.createdAt, transfers.id),
          db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId as `user_${string}`))
        ]).pipe(Effect.orDie)
        const total = usd(deposits.reduce((sum, deposit) => sum + deposit.amount, BigInt(0)))
        const set = { has_funded: true, funded_bucket: fundedBucket(total) }

        for (const row of added) {
          const dollars = usd(row.amount)
          const isFirst = deposits[0]?.id === row.id
          const fact = { id: row.id, at: row.createdAt, set }
          yield* analytics.capture(userId, {
            _tag: "deposit_detected",
            usd: dollars,
            usd_bucket: usdBucket(dollars),
            is_first: isFirst
          }, isFirst ? { ...fact, setOnce: { first_funded_at: DateTime.formatIso(row.createdAt) } } : fact)
          if (isFirst && user !== undefined) {
            yield* analytics.capture(userId, {
              _tag: "first_funded",
              usd_bucket: usdBucket(dollars),
              hours_since_signup: Math.max(
                0,
                (DateTime.toEpochMillis(row.createdAt) - DateTime.toEpochMillis(user.createdAt)) / 3_600_000
              )
            }, fact)
          }
        }
      })

      const check = Effect.fn("Reconciliation.check")(
        function*(options: { readonly userId?: UserId | undefined } = {}) {
          const startedAt = yield* DateTime.now
          const owners = yield* db.select({
            userId: accounts.userId,
            address: accounts.address,
            createdAt: users.createdAt,
            cursor: reconciliationCursors.blockNumber
          }).from(accounts)
            .innerJoin(users, eq(users.id, accounts.userId))
            .leftJoin(reconciliationCursors, eq(reconciliationCursors.userId, accounts.userId))
            .where(options.userId === undefined ? undefined : eq(accounts.userId, options.userId as `user_${string}`))
            .pipe(Effect.orDie)
          if (owners.length === 0) return { checked: 0, skipped: 0 }

          // The chain first, then the ledger: a fill the chain shows is in the ledger by now, or still on its way.
          const onchain = yield* readBalances(chain, owners.map((owner) => owner.address as Address)).pipe(Effect.orDie)
          const block = onchain.blockNumber
          const prices = yield* market.prices
          const ids = owners.map((owner) => owner.userId)

          const recent = DateTime.subtract(startedAt, { hours: 1 })
          const moving = yield* db.selectDistinct({ userId: trades.userId }).from(trades).where(and(
            inArray(trades.userId, ids),
            or(
              and(inArray(trades.status, ["sending", "confirming"]), gt(trades.createdAt, recent)),
              gte(trades.settledAt, startedAt)
            )
          )).union(
            db.selectDistinct({ userId: transfers.userId }).from(transfers).where(and(
              inArray(transfers.userId, ids),
              or(
                and(eq(transfers.status, "pending"), gt(transfers.createdAt, recent)),
                gte(transfers.settledAt, startedAt)
              )
            ))
          ).pipe(Effect.orDie)
          const skipped = new Set(moving.map((row) => row.userId))
          const ready = owners.filter((owner) => !skipped.has(owner.userId))

          const ledgered = new Map<string, Map<string, bigint>>()
          const add = (userId: string, asset: string, amount: bigint) => {
            const expected = ledgered.get(userId) ?? new Map<string, bigint>()
            expected.set(asset, (expected.get(asset) ?? zero) + amount)
            ledgered.set(userId, expected)
          }
          const readyIds = ready.map((owner) => owner.userId)
          if (readyIds.length > 0) {
            const filled = yield* db.select({ userId: trades.userId, side: trades.side, usdc: sum(trades.usdc) })
              .from(trades).where(and(inArray(trades.userId, readyIds), eq(trades.status, "filled")))
              .groupBy(trades.userId, trades.side).pipe(Effect.orDie)
            for (const row of filled) {
              add(row.userId, "USDC", (row.side === "sell" ? one : -one) * BigInt(row.usdc ?? 0))
            }

            const moved = yield* db.select({
              userId: transfers.userId,
              kind: transfers.kind,
              amount: sum(transfers.amount)
            })
              .from(transfers).where(and(
                inArray(transfers.userId, readyIds),
                eq(transfers.status, "confirmed"),
                eq(transfers.asset, "USDC")
              ))
              .groupBy(transfers.userId, transfers.kind).pipe(Effect.orDie)
            for (const row of moved) {
              add(row.userId, "USDC", (row.kind === "deposit" ? one : -one) * BigInt(row.amount ?? 0))
            }

            const adjusted = yield* db.select({
              userId: ledgerAdjustments.userId,
              amount: sum(ledgerAdjustments.amount)
            })
              .from(ledgerAdjustments).where(and(
                inArray(ledgerAdjustments.userId, readyIds),
                eq(ledgerAdjustments.asset, "USDC")
              ))
              .groupBy(ledgerAdjustments.userId).pipe(Effect.orDie)
            for (const row of adjusted) {
              add(row.userId, "USDC", BigInt(row.amount ?? 0))
            }

            const held = yield* db.select({ userId: lots.userId, symbol: lots.symbol, shares: sum(lots.remaining) })
              .from(lots).where(and(inArray(lots.userId, readyIds), gt(lots.remaining, zero)))
              .groupBy(lots.userId, lots.symbol).pipe(Effect.orDie)
            for (const row of held) add(row.userId, row.symbol, BigInt(row.shares ?? 0))
          }

          // Where each account's deposits are looked for: since its last check, or a new account's last hour.
          const fromBlock = (owner: (typeof owners)[number]) => {
            if (owner.cursor !== null) return owner.cursor + one
            if (DateTime.isGreaterThan(owner.createdAt, DateTime.subtract(startedAt, NEW_ACCOUNT))) {
              return block > LOOKBACK_BLOCKS ? block - LOOKBACK_BLOCKS : zero
            }
            return undefined
          }
          const deposits = new Map<string, Array<Deposit>>()
          const searched = ready.filter((owner) => fromBlock(owner) !== undefined)
          for (const [from, group] of Object.entries(Arr.groupBy(searched, (owner) => fromBlock(owner)!.toString()))) {
            if (BigInt(from) > block) continue
            const found = yield* depositLogs(group.map((owner) => owner.address as Address), BigInt(from), block).pipe(
              Effect.orDie
            )
            for (const [owner, logs] of found) deposits.set(owner, logs)
          }

          for (const owner of ready) {
            const userId = owner.userId as UserId
            const address = owner.address as Address
            const held = onchain.balances.get(address)!
            // Proceeds of a sale reach the account in a USDC transfer too.
            const tradeTxs = new Set(
              (yield* db.select({ txHash: trades.txHash }).from(trades)
                .where(and(eq(trades.userId, owner.userId), eq(trades.status, "filled"))).pipe(Effect.orDie))
                .map((trade) => trade.txHash?.toLowerCase())
            )

            const result = reconcile({
              opening: fromBlock(owner) === undefined,
              expected: ledgered.get(owner.userId) ?? new Map(),
              onchain: new Map(assets.map((asset, index) => [asset.symbol, held[index] ?? zero])),
              deposits: (deposits.get(address.toLowerCase()) ?? []).filter((log) =>
                !tradeTxs.has(log.txHash.toLowerCase())
              )
            })

            const now = yield* DateTime.now
            const { adjustmentRows, transferRows } = yield* db.transaction((tx) =>
              Effect.gen(function*() {
                const transferRows = []
                for (const deposit of result.deposits) {
                  const [seen] = yield* tx.select({ id: transfers.id }).from(transfers).where(and(
                    eq(transfers.userId, owner.userId),
                    eq(transfers.kind, "deposit"),
                    sql`lower(${transfers.txHash}) = ${deposit.txHash.toLowerCase()}`
                  ))
                  if (seen !== undefined) continue
                  const [row] = yield* tx.insert(transfers).values({
                    id: typeid("transfer").toString() as `transfer_${string}`,
                    userId: owner.userId,
                    kind: "deposit",
                    asset: "USDC",
                    amount: deposit.amount,
                    from: getAddress(deposit.from),
                    to: getAddress(address),
                    status: "confirmed",
                    txHash: deposit.txHash,
                    createdAt: now,
                    settledAt: now
                  }).returning()
                  transferRows.push(row!)
                  yield* outbox.write(LiveEvent.cases.TransferUpdated.make({ transfer: toTransfer(row!) }), userId)
                }

                const adjustmentRows = result.adjustments.length === 0 ?
                  [] :
                  yield* tx.insert(ledgerAdjustments).values(
                    result.adjustments.map((adjustment) => {
                      const price = adjustment.asset === "USDC"
                        ? undefined
                        : prices.get(adjustment.asset as StockSymbol)
                      const size = adjustment.amount < zero ? -adjustment.amount : adjustment.amount
                      const value = adjustment.asset === "USDC" ?
                        size :
                        price === undefined ?
                        zero :
                        valueOf(Shares.make(size), price.price)
                      return {
                        id: typeid("adjustment").toString() as `adjustment_${string}`,
                        userId: owner.userId,
                        asset: adjustment.asset,
                        reason: adjustment.reason,
                        amount: adjustment.amount,
                        price: price?.price ?? null,
                        value: adjustment.amount < zero ? -value : value,
                        blockNumber: block,
                        at: now
                      }
                    })
                  ).returning()
                for (const row of adjustmentRows) {
                  const name = stocks.find((stock) => stock.symbol === row.asset)?.name ?? row.asset
                  const draft = notificationOfAdjustment(row, name)
                  if (draft !== undefined) yield* outbox.notify(draft, userId)
                }

                yield* tx.insert(reconciliationCursors).values({
                  userId: owner.userId,
                  blockNumber: block,
                  checkedAt: now
                })
                  .onConflictDoUpdate({
                    target: reconciliationCursors.userId,
                    set: { blockNumber: block, checkedAt: now }
                  })
                return { adjustmentRows, transferRows }
              })
            ).pipe(Effect.orDie)

            for (const symbol of new Set(adjustmentRows.map((row) => row.asset))) {
              if (symbol !== "USDC") yield* ledger.rebuild(userId, symbol)
            }
            if (transferRows.length === 0 && adjustmentRows.length === 0) continue

            for (const row of transferRows) {
              yield* count(Deposits, { network: chain.network })
              yield* recordMetric(DepositsValue, usd(row.amount), { network: chain.network })
            }
            if (transferRows.length > 0) yield* tellDeposits(userId, transferRows)
            for (const row of adjustmentRows) {
              yield* count(ReconcileUnexplained, { asset: row.asset === "USDC" ? "usdc" : "stock" })
            }

            yield* balances.invalidate(address)
            for (const row of transferRows) {
              yield* live.publish(LiveEvent.cases.TransferUpdated.make({ transfer: toTransfer(row) }), userId)
            }
            yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), userId)
          }

          return { checked: ready.length, skipped: owners.length - ready.length }
        }
      )

      return Reconciliation.of({ check })
    })
  )
}
