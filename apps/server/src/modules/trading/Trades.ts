import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { swapCallGas, swapCalls } from "@bluechip/chain/market/Swaps"
import {
  type Conflict,
  InsufficientCash,
  InsufficientShares,
  type NotFound,
  NotTradable,
  PriceCheckFailed,
  type QuoteUnavailable,
  type SignatureRejected,
  Unavailable
} from "@bluechip/domain/Errors"
import type { Address, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { Quote, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween, type Shares, type Usdc } from "@bluechip/domain/market/Units"
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
import { Database } from "../../platform/db/Database.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { accounts } from "../accounts/tables.ts"
import { IntentStore } from "../intents/IntentStore.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { Quoter } from "../market/Quoter.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { OwnerOperations, type OwnerPasskey } from "../signing/OwnerOperations.ts"
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

export type TradeInput = {
  readonly requestId: string
  readonly symbol: StockSymbol
  readonly side: "buy" | "sell"
  readonly amount: { readonly usdc: Usdc } | { readonly shares: Shares }
}

/** The intent a trade carries out, and whether it is yours or an agent's trade you approved. */
export type TradeLink = {
  readonly intentId: string
  readonly agentId: string | null
  readonly source: "owner" | "approval"
}

/**
 * Buying and selling with the account's passkey: `prepare` reads balances, quotes the pool, checks the price against
 * Chainlink and builds one user operation (approve, swap); `confirm` checks the passkey's signature and sends it; the
 * trade is then followed to its receipt, where its fill is read, in the background (and again after a restart).
 */
export class Trades extends Context.Service<Trades, {
  readonly prepare: (
    owner: Owner,
    input: TradeInput,
    link: TradeLink
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
      const ledger = yield* TradeLedger
      const intents = yield* IntentStore
      const operations = yield* OwnerOperations
      const signing = yield* SigningRequests
      const scope = yield* Effect.scope

      const quoteCodec = Schema.fromJsonString(Schema.toCodecJson(Quote))

      const toTradeRequest = Effect.fnUntraced(function*(row: SigningRequestRow) {
        return new TradeRequest({
          id: row.id as SigningRequestId,
          options: yield* signing.webAuthnOptions(row),
          quote: Schema.decodeSync(quoteCodec)(row.payload["quote"]!),
          warnings: row.payload["warnings"] === "" ? [] : row.payload["warnings"]!.split(",") as Array<TradeWarning>,
          deploysAccount: row.deploysAccount,
          expiresAt: row.expiresAt
        })
      })

      // Follows a sent trade to its receipt in the background: how it ended, and its intent with it.
      const track = Effect.fnUntraced(
        function*(row: TradeRow, owner: Owner, passkey: OwnerPasskey) {
          const outcome = yield* operations.wait(passkey, row.userOpHash as Hex).pipe(Effect.result)
          const settled = yield* ledger.settle(
            row,
            owner.account as Hex,
            outcome._tag === "Success" ? outcome.success : undefined
          )
          if (settled === undefined || settled.intentId === null) return

          const intent = yield* intents.find(settled.intentId)
          if (intent === undefined) return
          yield* intents.advance(intent, { _tag: settled.status === "filled" ? "Filled" : "Failed" }).pipe(
            Effect.ignore
          )
        },
        Effect.forkIn(scope),
        Effect.asVoid
      )

      const pending = yield* db.select().from(trades)
        .innerJoin(accounts, eq(accounts.userId, trades.userId))
        .where(and(inArray(trades.status, ["sending", "confirming"]), isNotNull(trades.userOpHash)))
        .pipe(Effect.orDie)
      for (const { accounts: account, trades: row } of pending) {
        const owner = { id: row.userId as UserId, account: account.address as Address }
        yield* track(row, owner, yield* owners.ownerPasskey(owner.id))
      }

      const prepare = Effect.fn("Trades.prepare")(function*(owner: Owner, input: TradeInput, link: TradeLink) {
        const stock = stocks.find((candidate) => candidate.symbol === input.symbol)
        if (stock?.pool == null) return yield* new NotTradable({ symbol: input.symbol })
        const amountIn = "usdc" in input.amount ? input.amount.usdc : input.amount.shares

        const existing = yield* signing.findPrepared(
          owner,
          input.requestId,
          (payload) =>
            payload["symbol"] === input.symbol && payload["side"] === input.side &&
            payload["amountIn"] === amountIn.toString() && payload["intentId"] === link.intentId
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

        const quote = yield* quoter.quote(
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

        const now = yield* DateTime.now
        const warnings: Array<TradeWarning> = []
        if (quote.reference.status === "paused") warnings.push("pricesPaused")
        const price = (yield* market.prices).get(input.symbol)
        const recent = price !== undefined && Duration.isLessThan(DateTime.distance(price.tradedAt, now), RECENT_TRADE)
        if (recent && Math.abs(bpsBetween(price.price, quote.reference.price)) > APART_BPS) {
          warnings.push("marketApart")
        }

        const block = yield* chain.use("block", (client) => client.getBlock()).pipe(
          Effect.catchTag(
            "ChainError",
            () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))
          )
        )
        const row = yield* signing.create(owner, {
          requestId: input.requestId,
          kind: "trade",
          payload: {
            symbol: input.symbol,
            side: input.side,
            amountIn: amountIn.toString(),
            quote: Schema.encodeSync(quoteCodec)(quote),
            warnings: warnings.join(","),
            intentId: link.intentId,
            agentId: link.agentId ?? "",
            source: link.source
          },
          calls: swapCalls({
            stock,
            side: input.side,
            amountIn,
            minimumOut: quote.minimumOut,
            recipient: owner.account as Hex,
            deadline: block.timestamp + SWAP_DEADLINE_SECONDS
          }),
          minCallGas: swapCallGas
        })
        return yield* toTradeRequest(row)
      })

      const confirm = Effect.fn("Trades.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey, request } = yield* signing.claim(owner, id, "trade", credential)
        const payload = request.payload
        const quote = Schema.decodeSync(quoteCodec)(payload["quote"]!)
        const userOpHash = yield* operations.send(passkey, request.userOperation, credential)

        const row = yield* ledger.record({
          id: typeid("trade").toString() as `trade_${string}`,
          userId: owner.id as `user_${string}`,
          intentId: payload["intentId"] as `intent_${string}`,
          agentId: payload["agentId"] === "" ? null : payload["agentId"] as `agent_${string}`,
          source: payload["source"] as "owner" | "approval",
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
        })

        const intent = yield* intents.find(payload["intentId"]!)
        if (intent !== undefined) {
          yield* intents.advance(intent, { _tag: "Signed" }, { userOpHash, tradeId: row.id }).pipe(
            Effect.flatMap((sent) => intents.advance(sent, { _tag: "Accepted" })),
            Effect.catchTag("Conflict", () => Effect.logWarning(`Intent ${intent.id} had moved on before it was sent`))
          )
        }

        yield* track(row, owner, passkey)
        return toTrade(row)
      })

      return Trades.of({ prepare, confirm })
    })
  )
}
