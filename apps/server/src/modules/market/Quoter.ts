import { ChainClient } from "@bluechip/chain/ChainClient"
import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { NotTradable, QuoteUnavailable } from "@bluechip/domain/Errors"
import type { Address } from "@bluechip/domain/Ids"
import { Quote, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween, lessBps, priceOf, Shares, Usdc } from "@bluechip/domain/market/Units"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ReferencePrices } from "./ReferencePrices.ts"

// The default slippage tolerance: the trade may return up to 0.5% less than quoted.
const SLIPPAGE_BPS = 50
// Prices move; a quote stays current for this long.
const QUOTE_SECONDS = 30

/** A request for a quote: spend USDC on a stock, or sell its shares for USDC. */
export type QuoteRequest =
  | { readonly symbol: StockSymbol; readonly side: "buy"; readonly usdc: Usdc }
  | { readonly symbol: StockSymbol; readonly side: "sell"; readonly shares: Shares }

/** Quotes from the stocks' Aerodrome pools, compared with their Chainlink reference prices. */
export class Quoter extends Context.Service<Quoter, {
  /** What the trade would do in the stock's pool right now. */
  readonly quote: (request: QuoteRequest) => Effect.Effect<Quote, NotTradable | QuoteUnavailable>
}>()("@bluechip/server/Quoter") {
  static readonly layer = Layer.effect(
    Quoter,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { stocks, usdc } = yield* ChainDeployment
      const references = yield* ReferencePrices

      const quote = Effect.fn("Quoter.quote")(function*(request: QuoteRequest) {
        const stock = stocks.find((candidate) => candidate.symbol === request.symbol)
        if (stock?.pool == null) return yield* new NotTradable({ symbol: request.symbol })
        const pool = stock.pool

        const reference = yield* references.all.pipe(
          Effect.map((prices) => prices.get(request.symbol)),
          Effect.orElseSucceed(() => undefined)
        )
        if (reference === undefined) return yield* new QuoteUnavailable({ symbol: request.symbol, reason: "noPrice" })

        const amountIn = request.side === "buy" ? request.usdc : request.shares
        if (amountIn <= BigInt(0)) return yield* new QuoteUnavailable({ symbol: request.symbol, reason: "tooSmall" })

        const amountOut = yield* quoteExactIn(chain, {
          pool: pool.address,
          tokenIn: request.side === "buy" ? usdc : stock.token,
          amountIn
        }).pipe(Effect.mapError(() => new QuoteUnavailable({ symbol: request.symbol, reason: "poolError" })))
        if (amountOut === BigInt(0)) return yield* new QuoteUnavailable({ symbol: request.symbol, reason: "tooSmall" })

        const usdcAmount = Usdc.make(request.side === "buy" ? amountIn : amountOut)
        const shares = Shares.make(request.side === "buy" ? amountOut : amountIn)
        const price = priceOf(usdcAmount, shares)
        const quotedAt = yield* DateTime.now
        return new Quote({
          symbol: request.symbol,
          side: request.side,
          usdc: usdcAmount,
          shares,
          price,
          reference,
          // Paying above the reference is worse for a buyer; receiving below it is worse for a seller.
          gapBps: request.side === "buy" ? bpsBetween(price, reference.price) : bpsBetween(reference.price, price),
          minimumOut: lessBps(amountOut, SLIPPAGE_BPS),
          pool: pool.address as Address,
          quotedAt,
          expiresAt: DateTime.add(quotedAt, { seconds: QUOTE_SECONDS })
        })
      })

      return Quoter.of({ quote })
    })
  )
}
