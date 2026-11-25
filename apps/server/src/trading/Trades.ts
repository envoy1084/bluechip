import type { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { fillOf, swapCallGas, swapCalls } from "@bluechip/chain/market/Swaps"
import {
  type Conflict,
  InsufficientCash,
  InsufficientShares,
  NotFound,
  NotTradable,
  PriceCheckFailed,
  type QuoteUnavailable,
  type SignatureRejected,
  Unavailable
} from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { Address, SigningRequestId, TradeId, UserId } from "@bluechip/domain/Ids"
import { Quote, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween, priceOf, type Shares, type Usdc } from "@bluechip/domain/market/Units"
import { type Trade, TradeRequest, type TradeWarning, transition } from "@bluechip/domain/trading/Trade"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { and, eq, inArray, isNotNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import type { Hex } from "viem"
import type { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { accounts } from "../db/schema/accounts.ts"
import { trades } from "../db/schema/trading.ts"
import { LiveEvents } from "../live/LiveEvents.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { quote as quoteTrade } from "../market/Quoter.ts"
import type { ReferencePrices } from "../market/ReferencePrices.ts"
import type { Namera } from "../Namera.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { type OwnerPasskey, sendOperation, waitForOperation } from "../signing/OwnerOperations.ts"
import {
  claimSigningRequest,
  createSigningRequest,
  findPrepared,
  type Owner,
  ownerPasskey,
  type SigningRequestRow,
  webAuthnOptions
} from "../signing/SigningRequests.ts"
import { toTrade } from "./TradeRecords.ts"

// The fair-price check: how much worse than Chainlink a trade may be. Tighter while prices are paused (weekends,
// holidays), when Chainlink's is the last price before the pause and the pool may have drifted.
const LIVE_LIMIT_BPS = 100
const PAUSED_LIMIT_BPS = 50
// The stock market and Chainlink this far apart deserve a second look before signing.
const APART_BPS = 100
// Alpaca's free feed goes quiet after hours: an old last trade says nothing about how far apart they are.
const RECENT_TRADE = Duration.minutes(30)
// The swap's own deadline: past the signing window, so a signed trade can't fill at an old price much later.
const SWAP_DEADLINE = { minutes: 3 }

export type TradeInput = {
  readonly requestId: string
  readonly symbol: StockSymbol
  readonly side: "buy" | "sell"
  readonly amount: { readonly usdc: Usdc } | { readonly shares: Shares }
}

const QuoteJson = Schema.fromJsonString(Schema.toCodecJson(Quote))

/** What a fill moved, as the trade records it: exact USDC and shares, the price they make and its gap to Chainlink. */
const filled = (
  row: typeof trades.$inferSelect,
  fill: { readonly amountIn: bigint; readonly amountOut: bigint }
) => {
  const usdc = (row.side === "buy" ? fill.amountIn : fill.amountOut) as Usdc
  const shares = (row.side === "buy" ? fill.amountOut : fill.amountIn) as Shares
  const price = priceOf(usdc, shares)

  return {
    usdc,
    shares,
    price,
    // Paying above the reference is worse for a buyer; receiving below it is worse for a seller.
    gapBps: row.side === "buy" ? bpsBetween(price, row.reference) : bpsBetween(row.reference, price)
  }
}

const toTradeRequest = Effect.fnUntraced(function*(row: SigningRequestRow) {
  const payload = row.payload
  return new TradeRequest({
    id: row.id as SigningRequestId,
    options: yield* webAuthnOptions(row),
    quote: Schema.decodeSync(QuoteJson)(payload["quote"]!),
    warnings: payload["warnings"] === "" ? [] : payload["warnings"]!.split(",") as Array<TradeWarning>,
    deploysAccount: row.deploysAccount,
    expiresAt: row.expiresAt
  })
})

/**
 * Buying and selling with the account's passkey: `prepare` reads balances, quotes the pool, checks the price against
 * Chainlink and builds one user operation (approve, swap); `confirm` checks the passkey's signature and sends it; the
 * trade is then followed to its receipt, where its fill is read, in the background (and again after a restart).
 */
export class Trades extends Context.Service<Trades, {
  readonly prepare: (
    owner: Owner,
    input: TradeInput
  ) => Effect.Effect<
    TradeRequest,
    | InsufficientCash
    | InsufficientShares
    | NotTradable
    | QuoteUnavailable
    | PriceCheckFailed
    | NotFound
    | Conflict
    | Unavailable
  >
  readonly confirm: (
    owner: Owner,
    id: SigningRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<Trade, NotFound | SignatureRejected | Unavailable>
  readonly find: (owner: Owner, id: TradeId) => Effect.Effect<Trade, NotFound>
}>()("@bluechip/server/Trades") {
  static readonly layer = Layer.effect(
    Trades,
    Effect.gen(function*() {
      const db = yield* Database
      const live = yield* LiveEvents
      const balances = yield* AccountBalances
      const market = yield* MarketPrices
      const context = yield* Effect.context<Namera | Database | AppConfig | ReferencePrices | ChainClient>()
      const scope = yield* Effect.scope

      const settle = Effect.fnUntraced(function*(row: typeof trades.$inferSelect, owner: Owner, passkey: OwnerPasskey) {
        const stock = stocks.find((candidate) => candidate.symbol === row.symbol)!
        const outcome = yield* waitForOperation(passkey, row.userOpHash as Hex).pipe(Effect.result)
        const fill = outcome._tag === "Success" && outcome.success.success
          ? fillOf(outcome.success.logs, { stock, side: row.side }, owner.account as Hex)
          : undefined
        const next = transition(row.status, { _tag: fill === undefined ? "Failed" : "Filled" })
        if (Result.isFailure(next)) return yield* Effect.logWarning(`Trade ${row.id}: ${next.failure}`)

        const settledAt = yield* DateTime.now
        const txHash = outcome._tag === "Success" ? outcome.success.txHash : null
        const changes = { status: next.success, txHash, settledAt, ...(fill === undefined ? {} : filled(row, fill)) }

        const [updated] = yield* db.update(trades).set(changes).where(eq(trades.id, row.id)).returning()
          .pipe(Effect.orDie)

        // Fresh balances before the events, so a client that refetches on them sees the new holdings.
        yield* balances.invalidate(owner.account as Hex)
        if (updated !== undefined) {
          yield* live.publish(LiveEvent.cases.TradeUpdated.make({ trade: toTrade(updated) }), owner.id)
        }
        yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), owner.id)
      })

      const track = (row: typeof trades.$inferSelect, owner: Owner, passkey: OwnerPasskey) =>
        settle(row, owner, passkey).pipe(Effect.provideContext(context), Effect.forkIn(scope), Effect.asVoid)

      const pending = yield* db.select().from(trades)
        .innerJoin(accounts, eq(accounts.userId, trades.userId))
        .where(and(inArray(trades.status, ["sending", "confirming"]), isNotNull(trades.userOpHash)))
        .pipe(Effect.orDie)
      for (const { accounts: account, trades: row } of pending) {
        const owner = { id: row.userId as UserId, account: account.address as Address }
        const passkey = yield* ownerPasskey(owner.id).pipe(Effect.provideContext(context))
        yield* track(row, owner, passkey)
      }

      const warningsFor = Effect.fnUntraced(function*(symbol: StockSymbol, quote: Quote) {
        const warnings: Array<TradeWarning> = []
        if (quote.reference.status === "paused") warnings.push("pricesPaused")

        const price = (yield* market.prices).get(symbol)
        const recent = price !== undefined &&
          Duration.isLessThan(DateTime.distance(price.tradedAt, yield* DateTime.now), RECENT_TRADE)
        if (recent && Math.abs(bpsBetween(price.price, quote.reference.price)) > APART_BPS) {
          warnings.push("marketApart")
        }
        return warnings
      })

      const prepare = Effect.fn("Trades.prepare")(function*(owner: Owner, input: TradeInput) {
        const stock = stocks.find((candidate) => candidate.symbol === input.symbol)
        if (stock?.pool == null) return yield* new NotTradable({ symbol: input.symbol })
        const amountIn = "usdc" in input.amount ? input.amount.usdc : input.amount.shares

        const existing = yield* findPrepared(
          owner,
          input.requestId,
          (payload) =>
            payload["symbol"] === input.symbol && payload["side"] === input.side &&
            payload["amountIn"] === amountIn.toString()
        )
        if (Option.isSome(existing)) return yield* toTradeRequest(existing.value)

        yield* balances.invalidate(owner.account as Hex)
        const holdings = yield* balances.of(owner.account as Hex).pipe(
          Effect.catchTag(
            "ChainError",
            () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))
          )
        )
        const held = holdings.get(input.side === "buy" ? "USDC" : input.symbol) ?? BigInt(0)
        if (amountIn > held) {
          return yield* input.side === "buy"
            ? new InsufficientCash({ available: held })
            : new InsufficientShares({ symbol: input.symbol, available: held })
        }

        const quote = yield* quoteTrade(
          "usdc" in input.amount
            ? { symbol: input.symbol, side: "buy", usdc: input.amount.usdc }
            : { symbol: input.symbol, side: "sell", shares: input.amount.shares }
        )
        const limitBps = quote.reference.status === "paused" ? PAUSED_LIMIT_BPS : LIVE_LIMIT_BPS
        if (quote.reference.status === "stale" || quote.gapBps > limitBps) {
          return yield* new PriceCheckFailed({
            symbol: input.symbol,
            reason: quote.reference.status === "stale" ? "stale" : "gap",
            gapBps: quote.gapBps,
            limitBps
          })
        }

        const warnings = yield* warningsFor(input.symbol, quote)
        const deadline = DateTime.toEpochMillis(DateTime.add(yield* DateTime.now, SWAP_DEADLINE))
        const row = yield* createSigningRequest(owner, {
          requestId: input.requestId,
          kind: "trade",
          payload: {
            symbol: input.symbol,
            side: input.side,
            amountIn: amountIn.toString(),
            quote: Schema.encodeSync(QuoteJson)(quote),
            warnings: warnings.join(",")
          },
          calls: swapCalls({
            stock,
            side: input.side,
            amountIn,
            minimumOut: quote.minimumOut,
            recipient: owner.account as Hex,
            deadline: BigInt(Math.floor(deadline / 1000))
          }),
          minCallGas: swapCallGas
        })
        return yield* toTradeRequest(row)
      }, Effect.provideContext(context))

      const confirm = Effect.fn("Trades.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey, request } = yield* claimSigningRequest(owner, id, "trade", credential)
        const quote = Schema.decodeSync(QuoteJson)(request.payload["quote"]!)
        const userOpHash = yield* sendOperation(passkey, request.userOperation, credential)

        const [row] = yield* db.insert(trades).values({
          id: typeid("trade").toString() as `trade_${string}`,
          userId: owner.id as `user_${string}`,
          symbol: quote.symbol,
          side: quote.side,
          status: Result.getOrThrow(transition("sending", { _tag: "Accepted" })),
          usdc: quote.usdc,
          shares: quote.shares,
          price: quote.price,
          reference: quote.reference.price,
          referenceStatus: quote.reference.status,
          gapBps: quote.gapBps,
          userOpHash,
          createdAt: yield* DateTime.now
        }).returning().pipe(Effect.orDie)

        yield* track(row!, owner, passkey)
        return toTrade(row!)
      }, Effect.provideContext(context))

      const find = Effect.fn("Trades.find")(function*(owner: Owner, id: TradeId) {
        const [row] = yield* db.select().from(trades)
          .where(and(eq(trades.id, id as `trade_${string}`), eq(trades.userId, owner.id as `user_${string}`)))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "trade", id })
        return toTrade(row)
      })

      return { prepare, confirm, find }
    })
  )
}
