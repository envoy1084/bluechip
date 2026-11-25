/**
 * Read tools over your money and the market: your portfolio, prices, quotes and activity.
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { ActivityItem, ActivityKind, ActivityPeriod } from "../activity/Activity.ts"
import { Quote, Stock, StockSymbol } from "../market/Market.ts"
import { Portfolio } from "../portfolio/Portfolio.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { Risk } from "./Risk.ts"
import { change, price, say, shares, usd } from "./Words.ts"

const stockLine = (stock: Stock) =>
  `${stock.symbol} (${stock.name}): ` +
  (stock.price === null ? "no price right now" : price(stock.price.price)) +
  (stock.change24h === null ? "" : `, ${change(stock.change24h)} since the previous close`) +
  (stock.reference === null ? "" : `, Chainlink ${price(stock.reference.price)} (${stock.reference.status})`) +
  (stock.tradable ? "" : ", not tradable")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetPortfolio = Tool.make("getPortfolio", {
  description: "The user's portfolio now: cash, each holding with its value and weight, and the change since the " +
    "previous close. The user sees it as a card; refer to it rather than repeating every number.",
  success: Portfolio,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (portfolio) =>
    say([
      `Total ${usd(portfolio.value)}: cash ${usd(portfolio.cash)}, stocks ${usd(portfolio.invested)}, ` +
      `${portfolio.change24h >= 0 ? "up" : "down"} ${
        usd(portfolio.change24h < 0 ? -portfolio.change24h : portfolio.change24h)
      } since the previous close.`,
      ...portfolio.holdings.map((holding) =>
        `${holding.symbol}: ${shares(holding.shares)} shares worth ${usd(holding.value)} (${holding.weightBps / 100}%)`
      )
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetPrices = Tool.make("getPrices", {
  description: "Prices of the stocks bluechip trades: the market price, its change since the previous close, and " +
    "Chainlink's price that trades are checked against.",
  parameters: Schema.Struct({
    symbols: Schema.Array(StockSymbol).annotate({ description: "The stocks to price; empty for every stock." })
  }),
  success: Schema.Array(Stock),
  failure: ToolProblem,
  failureMode: "return",
  toModelOutput: (stocks) => say(stocks.map(stockLine))
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetStock = Tool.make("getStock", {
  description: "One stock: its name, price, change since the previous close and Chainlink's price.",
  parameters: Schema.Struct({ symbol: StockSymbol }),
  success: Stock,
  failure: ToolProblem,
  failureMode: "return",
  toModelOutput: (stock) => say(stockLine(stock))
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetQuote = Tool.make("getQuote", {
  description: "What a trade would get in the stock's pool right now, and how far that is from Chainlink's price. " +
    "Give dollars for a buy and shares for a sell. A quote trades nothing.",
  parameters: Schema.Struct({
    symbol: StockSymbol,
    side: Schema.Literals(["buy", "sell"]),
    dollars: Schema.NullOr(Schema.Finite).annotate({ description: "Dollars to spend on a buy; null for a sell." }),
    shares: Schema.NullOr(Schema.Finite).annotate({ description: "Shares to sell; null for a buy." })
  }),
  success: Quote,
  failure: ToolProblem,
  failureMode: "return",
  toModelOutput: (quote) =>
    say(
      `${quote.side === "buy" ? "Buying" : "Selling"} ${shares(quote.shares)} ${quote.symbol} for ${usd(quote.usdc)} ` +
        `at ${price(quote.price)} a share, ${quote.gapBps / 100}% ${quote.gapBps >= 0 ? "worse" : "better"} than ` +
        `Chainlink (${price(quote.reference.price)}).`
    )
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetActivity = Tool.make("getActivity", {
  description: "The user's latest trades and withdrawals, newest first (up to 20).",
  parameters: Schema.Struct({ kind: ActivityKind, period: ActivityPeriod }),
  success: Schema.Array(ActivityItem),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (items) =>
    say(
      items.length === 0 ? "Nothing in this period." : items.map((item) =>
        item._tag === "Trade" ?
          `${item.trade.side === "buy" ? "Bought" : "Sold"} ${shares(item.trade.shares)} ${item.trade.symbol} for ` +
          `${usd(item.trade.usdc)} (${item.trade.status})` :
          `Withdrew ${item.transfer.asset} (${item.transfer.status})`
      )
    )
}).annotate(Risk, "read")
