import { ChainClient } from "@bluechip/chain/ChainClient"
import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { swapCallGas, swapCalls } from "@bluechip/chain/market/Swaps"
import { usdBucket } from "@bluechip/domain/analytics/Buckets"
import {
  Conflict,
  InsufficientCash,
  InsufficientShares,
  type NotFound,
  NotTradable,
  PriceCheckFailed,
  QuoteUnavailable,
  type SignatureRejected,
  Unavailable
} from "@bluechip/domain/Errors"
import type { Address, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { Leg } from "@bluechip/domain/intents/Intent"
import { Quote } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import { MINIMUM_BUY, type Trade, TradeRequest, type TradeWarning, transition } from "@bluechip/domain/trading/Trade"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import * as Array from "effect/Array"
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
import { Database } from "../../platform/db/Database.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { accounts } from "../accounts/tables.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { type IntentRow, IntentStore } from "../intents/IntentStore.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { Quoter } from "../market/Quoter.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { OwnerOperations, type OwnerPasskey, shareOf } from "../signing/OwnerOperations.ts"
import { type Owner, type SigningRequestRow, SigningRequests } from "../signing/SigningRequests.ts"
import { trades } from "./tables.ts"
import { toTrade, TradeLedger, type TradeRow } from "./TradeLedger.ts"

// The fair-price check: how much worse than Chainlink a trade may be. Tighter while prices are paused (weekends,
// holidays), when Chainlink's is the last price before the pause and the pool may have drifted.
const LIVE_LIMIT_BPS = 100
const PAUSED_LIMIT_BPS = 50
// The stock market and Chainlink this far apart deserve a second look before signing.
const APART_BPS = 100
// Alpaca's free feed goes quiet after hours: an old last trade says nothing about how far apart they are.
const RECENT_TRADE = Duration.minutes(30)
// The swap's own deadline: past the signing window, so a signed trade can't fill at an old price much later. Counted
// from the chain's latest block, since the swap checks it against `block.timestamp`, not the server's clock.
const SWAP_DEADLINE_SECONDS = BigInt(180)

/** The intent a trade carries out, and whether it is yours or an agent's trade you approved. */
export type TradeLink = {
  readonly intentId: string
  readonly agentId: string | null
  readonly source: "owner" | "approval"
}

/** One trade of an owner operation: what to trade, and the intent it carries out. */
export type OwnerLeg = {
  readonly leg: Leg
  readonly link: TradeLink
}

/**
 * Buying and selling with the account's passkey: `prepare` reads balances, quotes the pools, checks each price
 * against Chainlink and builds one user operation for every leg (approve, swap each; sells first, so their cash pays
 * for the buys); `confirm` checks the passkey's signature and sends it; each trade is then followed to its receipt,
 * where its fill is read, in the background (and again after a restart).
 */
export class Trades extends Context.Service<Trades, {
  readonly prepare: (
    owner: Owner,
    requestId: string,
    legs: ReadonlyArray<OwnerLeg>
  ) => Effect.Effect<
    { readonly request: TradeRequest; readonly quotes: ReadonlyArray<Quote> },
    | InsufficientCash
    | InsufficientShares
    | NotTradable
    | QuoteUnavailable
    | PriceCheckFailed
    | NotFound
    | Conflict
    | Unavailable
  >
  /**
   * Sends trades signed with your passkey, and returns the first. One prepared for an intent that has moved on while
   * you signed (an approval that expired or was declined, or its agent paused) is refused with `Conflict`, never sent.
   */
  readonly confirm: (
    owner: Owner,
    id: SigningRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<Trade, NotFound | Conflict | SignatureRejected | Unavailable>
}>()("@bluechip/server/Trades") {
  static readonly layer = Layer.effect(
    Trades,
    Effect.gen(function*() {
      const db = yield* Database
      const owners = yield* Accounts
      const balances = yield* AccountBalances
      const market = yield* MarketPrices
      const quoter = yield* Quoter
      const chain = yield* ChainClient
      const deployment = yield* ChainDeployment
      const ledger = yield* TradeLedger
      const intents = yield* IntentStore
      const operations = yield* OwnerOperations
      const signing = yield* SigningRequests
      const scope = yield* Effect.scope
      const analytics = yield* Analytics

      // Each leg of a request as its payload keeps it: the trade, its quote, and the intent it carries out.
      const PreparedLegs = Schema.fromJsonString(Schema.toCodecJson(Schema.Array(Schema.Struct({
        leg: Leg,
        quote: Quote,
        intentId: Schema.String,
        agentId: Schema.NullOr(Schema.String),
        source: Schema.Literals(["owner", "approval"])
      }))))

      const legsOf = (row: SigningRequestRow) => Schema.decodeSync(PreparedLegs)(row.payload["legs"]!)

      const toTradeRequest = Effect.fnUntraced(function*(row: SigningRequestRow) {
        const quotes = legsOf(row).map((prepared) => prepared.quote)
        return {
          request: new TradeRequest({
            id: row.id as SigningRequestId,
            options: yield* signing.webAuthnOptions(row),
            quote: quotes[0]!,
            warnings: row.payload["warnings"] === "" ? [] : row.payload["warnings"]!.split(",") as Array<TradeWarning>,
            deploysAccount: row.deploysAccount,
            expiresAt: row.expiresAt
          }),
          quotes
        }
      })

      // Follows sent trades (one operation) to its receipt in the background: how each ended, and its intent with it.
      const track = Effect.fnUntraced(
        function*(rows: ReadonlyArray<TradeRow>, owner: Owner, passkey: OwnerPasskey) {
          const outcome = yield* operations.wait(passkey, rows[0]!.userOpHash as Hex, "trade").pipe(Effect.result)
          for (const [index, row] of rows.entries()) {
            const settled = yield* ledger.settle(
              row,
              owner.account as Hex,
              outcome._tag === "Success" ? shareOf(outcome.success, index, rows.length) : undefined
            )
            if (settled === undefined || settled.intentId === null) continue

            const intent = yield* intents.find(settled.intentId)
            if (intent === undefined) continue
            yield* intents.advance(intent, { _tag: settled.status === "filled" ? "Filled" : "Failed" }).pipe(
              Effect.ignore
            )
          }
        },
        Effect.forkIn(scope),
        Effect.asVoid
      )

      const pending = yield* db.select().from(trades)
        .innerJoin(accounts, eq(accounts.userId, trades.userId))
        .where(and(inArray(trades.status, ["sending", "confirming"]), isNotNull(trades.userOpHash)))
        .orderBy(asc(trades.createdAt), asc(trades.id))
        .pipe(Effect.orDie)
      const operationsPending = Array.groupBy(pending, ({ trades: row }) => row.userOpHash!)
      for (const operation of Object.values(operationsPending)) {
        const account = operation[0]!.accounts
        const owner = { id: account.userId as UserId, account: account.address as Address }
        yield* track(operation.map((row) => row.trades), owner, yield* owners.ownerPasskey(owner.id))
      }

      const prepare = Effect.fn("Trades.prepare")(
        function*(owner: Owner, requestId: string, legs: ReadonlyArray<OwnerLeg>) {
          // Sells first: their cash is there for the buys.
          const ordered = [
            ...legs.filter(({ leg }) => leg.side === "sell"),
            ...legs.filter(({ leg }) => leg.side === "buy")
          ]
          for (const { leg } of ordered) {
            const stock = deployment.stocks.find((candidate) => candidate.symbol === leg.symbol)
            if (stock?.pool == null) return yield* new NotTradable({ symbol: leg.symbol })
            if ("usdc" in leg.amount && leg.amount.usdc < MINIMUM_BUY) {
              return yield* new QuoteUnavailable({ symbol: leg.symbol, reason: "belowMinimum" })
            }
          }

          const amountOf = (leg: Leg) => "usdc" in leg.amount ? leg.amount.usdc : leg.amount.shares
          const existing = yield* signing.findPrepared(owner, requestId, (payload) => {
            const prepared = Schema.decodeUnknownOption(PreparedLegs)(payload["legs"])
            return Option.isSome(prepared) && prepared.value.length === ordered.length &&
              prepared.value.every(({ intentId, leg }, index) => {
                const asked = ordered[index]!
                return intentId === asked.link.intentId && leg.symbol === asked.leg.symbol &&
                  leg.side === asked.leg.side && amountOf(leg) === amountOf(asked.leg)
              })
          })
          if (Option.isSome(existing)) return yield* toTradeRequest(existing.value)

          const unavailable = () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))
          yield* balances.invalidate(owner.account as Hex)
          const holdings = yield* balances.of(owner.account as Hex).pipe(Effect.catchTag("ChainError", unavailable))

          // Each sale within the shares held; the buys within the cash held and, once quoted, what the sales pay.
          for (const { leg } of ordered) {
            if (!("shares" in leg.amount)) continue
            const held = holdings.get(leg.symbol) ?? BigInt(0)
            if (leg.amount.shares > held) return yield* new InsufficientShares({ symbol: leg.symbol, available: held })
          }
          const cash = holdings.get("USDC") ?? BigInt(0)
          const buying = ordered.reduce((sum, { leg }) => "usdc" in leg.amount ? sum + leg.amount.usdc : sum, BigInt(0))
          const selling = ordered.some(({ leg }) => leg.side === "sell")
          if (!selling && buying > cash) return yield* new InsufficientCash({ available: cash })

          // A sale's dollars are known only once quoted: a failed one counts in the smallest range.
          const quotes = yield* Effect.forEach(ordered, ({ leg }, index) =>
            quoter.quote(
              "usdc" in leg.amount
                ? { symbol: leg.symbol, side: "buy", usdc: leg.amount.usdc }
                : { symbol: leg.symbol, side: "sell", shares: leg.amount.shares }
            ).pipe(
              Effect.tap((quote) =>
                analytics.capture(owner.id, {
                  _tag: "quote_requested",
                  symbol: leg.symbol,
                  side: leg.side,
                  usd_bucket: usdBucket(Number(quote.usdc) / 1e6)
                }, { id: `${requestId}:${index}` })
              ),
              Effect.tapError((error) =>
                analytics.capture(owner.id, {
                  _tag: "quote_failed",
                  symbol: leg.symbol,
                  side: leg.side,
                  usd_bucket: usdBucket("usdc" in leg.amount ? Number(leg.amount.usdc) / 1e6 : 0),
                  reason: error._tag === "QuoteUnavailable" ? error.reason : "notTradable"
                }, { id: `${requestId}:${index}` })
              )
            ))
          const fromSales = quotes.reduce(
            (sum, quote) => quote.side === "sell" ? sum + quote.minimumOut : sum,
            BigInt(0)
          )
          if (buying > cash + fromSales) return yield* new InsufficientCash({ available: cash })

          const now = yield* DateTime.now
          const marketPrices = yield* market.prices
          const warnings = new Set<TradeWarning>()
          for (const quote of quotes) {
            const limitBps = quote.reference.status === "paused" ? PAUSED_LIMIT_BPS : LIVE_LIMIT_BPS
            if (quote.reference.status === "stale" || quote.gapBps > limitBps) {
              return yield* new PriceCheckFailed({
                symbol: quote.symbol,
                reason: quote.reference.status === "stale" ? "stale" : "gap",
                gapBps: quote.gapBps,
                limitBps
              })
            }

            if (quote.reference.status === "paused") warnings.add("pricesPaused")
            const price = marketPrices.get(quote.symbol)
            const recent = price !== undefined &&
              Duration.isLessThan(DateTime.distance(price.tradedAt, now), RECENT_TRADE)
            if (recent && Math.abs(bpsBetween(price.price, quote.reference.price)) > APART_BPS) {
              warnings.add("marketApart")
            }
          }

          const block = yield* chain.use("block", (client) => client.getBlock()).pipe(
            Effect.catchTag("ChainError", unavailable)
          )
          const row = yield* signing.create(owner, {
            requestId,
            kind: "trade",
            payload: {
              legs: Schema.encodeSync(PreparedLegs)(ordered.map(({ leg, link }, index) => ({
                leg,
                quote: quotes[index]!,
                intentId: link.intentId,
                agentId: link.agentId,
                source: link.source
              }))),
              warnings: [...warnings].join(",")
            },
            calls: ordered.flatMap(({ leg }, index) =>
              swapCalls(deployment, {
                stock: deployment.stocks.find((candidate) => candidate.symbol === leg.symbol)!,
                side: leg.side,
                amountIn: "usdc" in leg.amount ? leg.amount.usdc : leg.amount.shares,
                minimumOut: quotes[index]!.minimumOut,
                recipient: owner.account as Hex,
                deadline: block.timestamp + SWAP_DEADLINE_SECONDS
              })
            ),
            minCallGas: swapCallGas * BigInt(ordered.length)
          })
          return yield* toTradeRequest(row)
        }
      )

      const confirm = Effect.fn("Trades.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey, request } = yield* signing.claim(owner, id, "trade", credential)
        const prepared = legsOf(request)

        // Every leg's intent still waiting for this signature, or none is sent.
        const waiting: Array<IntentRow | undefined> = []
        for (const item of prepared) {
          const intent = yield* intents.find(item.intentId)
          if (intent !== undefined && intent.status !== "awaitingSignature") {
            return yield* new Conflict({ reason: "intentClosed" })
          }
          waiting.push(intent)
        }
        // Claimed for sending first: a decline or an expiry landing during the send then loses with a conflict, and
        // never the reverse (a trade sent for an intent that says declined).
        const sending: Array<IntentRow | undefined> = []
        for (const intent of waiting) {
          sending.push(intent === undefined ? undefined : yield* intents.advance(intent, { _tag: "Signed" }))
        }
        const userOpHash = yield* operations.send(passkey, request.userOperation, credential).pipe(
          Effect.tapError(() =>
            Effect.forEach(
              sending,
              (intent) =>
                intent === undefined ? Effect.void : intents.advance(intent, { _tag: "Failed" }).pipe(Effect.ignore)
            )
          )
        )

        const now = yield* DateTime.now
        const rows: Array<TradeRow> = []
        for (const [index, item] of prepared.entries()) {
          const { quote } = item
          const row = yield* ledger.record({
            id: typeid("trade").toString() as `trade_${string}`,
            userId: owner.id as `user_${string}`,
            intentId: item.intentId as `intent_${string}`,
            agentId: item.agentId as `agent_${string}` | null,
            source: item.source,
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
            createdAt: now
          })
          rows.push(row)
          yield* analytics.capture(owner.id, {
            _tag: "trade_signed",
            symbol: quote.symbol,
            side: quote.side,
            usd_bucket: usdBucket(Number(quote.usdc) / 1e6)
          }, { id: row.id, at: now })

          const intent = sending[index]
          if (intent === undefined) continue
          // Sent: the trade is followed whatever the intent says now.
          yield* intents.advance(intent, { _tag: "Accepted" }, { userOpHash, tradeId: row.id }).pipe(
            Effect.catchTag("Conflict", () => Effect.logWarning(`Intent ${intent.id} moved on while it was sent`))
          )
        }

        yield* track(rows, owner, passkey)
        return toTrade(rows[0]!)
      })

      return Trades.of({ prepare, confirm })
    })
  )
}
