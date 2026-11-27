import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { DevChain } from "@bluechip/chain/DevChain"
import { FaucetLimitReached, Forbidden, InvalidRequest, Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { TxHash, UserId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { allowanceAt, type FaucetAllowance, FaucetGrant } from "@bluechip/domain/paper/Faucet"
import { and, eq, gte, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import { parseEther } from "viem"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { count, FaucetMints, FaucetValue, record as recordMetric, usd } from "../../platform/telemetry/Metrics.ts"
import { users } from "../accounts/tables.ts"
import { Operator } from "../paper/Operator.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { faucetGrants } from "./tables.ts"

/**
 * Test money where money is pretend, up to a daily allowance per account (`allowanceAt`): on paper money the operator
 * mints test USDC to the account; on the local chain the devnet sends USDC, with ETH for gas, as `POST /api/dev/fund`
 * does. Elsewhere (Base) there is no faucet (`Forbidden`).
 */
export class Faucet extends Context.Service<Faucet, {
  readonly allowance: (userId: UserId) => Effect.Effect<FaucetAllowance, Forbidden>
  readonly claim: (
    user: { readonly id: UserId; readonly account: `0x${string}` },
    amount: Usdc
  ) => Effect.Effect<FaucetGrant, Forbidden | InvalidRequest | FaucetLimitReached | Unavailable>
}>()("@bluechip/server/Faucet") {
  static readonly layer = Layer.effect(
    Faucet,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const dev = yield* Effect.serviceOption(DevChain)
      const operator = yield* Effect.serviceOption(Operator)
      const balances = yield* AccountBalances
      const live = yield* LiveEvents

      // Sends the test money and answers its transaction (none on the local chain, whose controls send at once).
      const send = (account: `0x${string}`, amount: Usdc): Effect.Effect<TxHash | null, ChainError> => {
        if (Option.isSome(operator)) return operator.value.mintUsdc(account, amount)
        if (Option.isSome(dev)) {
          return dev.value.setEthBalance(account, parseEther("0.05")).pipe(
            Effect.andThen(dev.value.sendUsdc(account, amount)),
            Effect.as(null)
          )
        }
        return Effect.die(new Error(`Faucet: nothing sends test money on ${chain.network}`))
      }

      const grantedSince = (executor: Pick<typeof db, "select">, userId: UserId, since: DateTime.Utc) =>
        executor.select({ total: sql<string>`coalesce(sum(${faucetGrants.amount}), 0)` })
          .from(faucetGrants)
          .where(and(eq(faucetGrants.userId, userId as `user_${string}`), gte(faucetGrants.createdAt, since)))
          .pipe(Effect.map(([row]) => Usdc.make(BigInt(row?.total ?? "0"))))

      const available = Option.isNone(operator) && Option.isNone(dev) ? Effect.fail(new Forbidden()) : Effect.void

      const allowance = Effect.fn("Faucet.allowance")(function*(userId: UserId) {
        yield* available
        const now = yield* DateTime.now
        const granted = yield* grantedSince(db, userId, DateTime.startOf(now, "day")).pipe(Effect.orDie)
        return allowanceAt(granted, now)
      })

      const claim = Effect.fn("Faucet.claim")(
        function*(user: { readonly id: UserId; readonly account: `0x${string}` }, amount: Usdc) {
          yield* available
          if (amount === BigInt(0)) return yield* new InvalidRequest({ field: "amount", problem: "outOfRange" })
          const now = yield* DateTime.now
          const userId = user.id as `user_${string}`

          // The user's row is locked while the day's grants are summed, so two claims at once can't both fit.
          const reserved = yield* db.transaction((tx) =>
            Effect.gen(function*() {
              yield* tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update")
              const before = allowanceAt(yield* grantedSince(tx, user.id, DateTime.startOf(now, "day")), now)
              if (amount > before.remaining) return { id: null, before }

              const id = typeid("grant").toString() as `grant_${string}`
              yield* tx.insert(faucetGrants).values({ id, userId, account: user.account, amount, createdAt: now })
              return { id, before }
            })
          ).pipe(Effect.orDie)

          if (reserved.id === null) {
            yield* count(FaucetMints, { outcome: "over_daily_limit" })
            return yield* new FaucetLimitReached({
              remaining: reserved.before.remaining,
              resetsAt: reserved.before.resetsAt
            })
          }
          const grantId = reserved.id

          const txHash: TxHash | null = yield* send(user.account, amount).pipe(
            Effect.tapError((error) =>
              Effect.andThen(
                Effect.logWarning("Faucet: the test money wasn't sent", error),
                count(FaucetMints, { outcome: "failed" })
              )
            ),
            Effect.catchTag("ChainError", () =>
              db.delete(faucetGrants).where(eq(faucetGrants.id, grantId)).pipe(
                Effect.orDie,
                Effect.andThen(Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: null })))
              ))
          )
          if (txHash !== null) {
            yield* db.update(faucetGrants).set({ txHash }).where(eq(faucetGrants.id, grantId)).pipe(Effect.orDie)
          }

          yield* count(FaucetMints, { outcome: "minted" })
          yield* recordMetric(FaucetValue, usd(amount), {})
          yield* balances.invalidate(user.account)
          yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), user.id)

          return new FaucetGrant({
            amount,
            txHash,
            allowance: allowanceAt(Usdc.make(reserved.before.limit - reserved.before.remaining + amount), now)
          })
        }
      )

      return Faucet.of({ allowance, claim })
    })
  )
}
