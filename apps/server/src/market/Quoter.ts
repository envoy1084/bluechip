import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { NotTradable, QuoteUnavailable } from "@bluechip/domain/Errors"
import type { Address } from "@bluechip/domain/Ids"
import { Quote, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween, lessBps, priceOf, Shares, Usdc } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { PriceFeed } from "./PriceFeed.ts"

// The default slippage tolerance: the trade may return up to 0.5% less than quoted.
const SLIPPAGE_BPS = 50
// Prices move; a quote stays current for this long.
const QUOTE_SECONDS = 30

/** A request for a quote: spend USDC on a stock, or sell its shares for USDC. */
export type QuoteRequest =
  | { readonly symbol: StockSymbol; readonly side: "buy"; readonly usdc: Usdc }
  | { readonly symbol: StockSymbol; readonly side: "sell"; readonly shares: Shares }

/**
 * What the trade would do in the stock's Aerodrome pool right now, compared with its Chainlink reference price.
 */
export const quote = Effect.fn("Quoter.quote")(function*(request: QuoteRequest) {
  const stock = stocks.find((candidate) => candidate.symbol === request.symbol)
  if (stock?.pool == null) return yield* new NotTradable({ symbol: request.symbol })
  const pool = stock.pool
  const feed = yield* PriceFeed
  const { prices } = yield* feed.snapshot
  const reference = prices.get(request.symbol)
  if (reference === undefined) return yield* new QuoteUnavailable({ symbol: request.symbol, reason: "noPrice" })
  const amountIn = request.side === "buy" ? request.usdc : request.shares
  if (amountIn <= BigInt(0)) return yield* new QuoteUnavailable({ symbol: request.symbol, reason: "tooSmall" })

  const chain = yield* ChainClient
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
