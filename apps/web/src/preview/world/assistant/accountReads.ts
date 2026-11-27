// The read tools about your money, with results built from the cast: the portfolio, prices, a stock, activity, a
// stock's facts and how you, a stock, an agent or an automation did. Each tool row sums its result up ("$4,212",
// "+$412 in all", "3 trades"), or says it's empty, as the real one would.
import { baseDeployment } from "@bluechip/chain/deployments/Base"
import type { Address, AgentId, AutomationId, TradeId } from "@bluechip/domain/Ids"
import { StockFacts } from "@bluechip/domain/knowledge/Knowledge"
import { MarketPrice, ReferencePrice, Stock, type StockSymbol } from "@bluechip/domain/market/Market"
import { Bps, Price, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import {
  AgentLine,
  AgentPerformance,
  AutomationPerformance,
  BlockedBy,
  Costs,
  PnlPoint,
  PortfolioPerformance,
  RunCount,
  StockLine,
  StockPerformance
} from "@bluechip/domain/performance/Performance"
import { Holding, Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { GetStockFacts } from "@bluechip/domain/tools/KnowledgeTools"
import { GetActivity, GetPortfolio, GetPrices, GetStock } from "@bluechip/domain/tools/MarketTools"
import {
  GetAgentPerformance,
  GetAutomationPerformance,
  GetPerformance,
  GetStockPerformance
} from "@bluechip/domain/tools/PerformanceTools"
import { Trade } from "@bluechip/domain/trading/Trade"
import * as DateTime from "effect/DateTime"
import { changeOf } from "../market/prices.ts"
import { nameOf, priceOf, shares, usdc } from "./castRecords.ts"
import type { Mint } from "./mint.ts"
import { type Beat, read } from "./rounds.ts"

const TOKEN = "0x2f8c0000000000000000000000000000000a11ce" as Address
// A stock's move today, its own on a mixed day, so each holding moves by its own amount.
const dayChange = (symbol: StockSymbol) => Bps.make(Math.round(changeOf(symbol, "mixed") * 10_000))

const FEED = "0x7a3b0000000000000000000000000000000fee0d" as Address

const marketPrice = (mint: Mint, symbol: StockSymbol) =>
  new MarketPrice({
    symbol,
    price: priceOf(symbol),
    tradedAt: mint.at(0.02),
    previousClose: Price.make(priceOf(symbol) * BigInt(985) / BigInt(1000))
  })

const stockOf = (mint: Mint, symbol: StockSymbol, priced: boolean) =>
  new Stock({
    symbol,
    name: nameOf(symbol),
    token: TOKEN,
    tradable: true,
    logoUrl: null,
    price: priced ? marketPrice(mint, symbol) : null,
    reference: priced ?
      new ReferencePrice({ symbol, price: priceOf(symbol), updatedAt: mint.at(0.02), status: "live" }) :
      null,
    change24h: priced ? dayChange(symbol) : null
  })

/** The cast's portfolio now; `empty` for an account with nothing in it yet. */
export const getPortfolio = (mint: Mint, empty = false): Beat => {
  const held = empty ? [] : mint.cast.holdings.map((holding) => {
    const count = shares(holding.shares)
    return { symbol: holding.symbol, shares: count, value: valueOf(count, priceOf(holding.symbol)) }
  })
  const cash = usdc(empty ? 0 : mint.cast.cash)
  const invested = Usdc.make(held.reduce((sum, holding) => sum + holding.value, BigInt(0)))
  const value = Usdc.make(invested + cash)
  return read(
    mint,
    "getPortfolio",
    {},
    GetPortfolio.successSchema,
    new Portfolio({
      cash,
      invested,
      value,
      holdings: held.map((holding) =>
        new Holding({
          ...holding,
          price: marketPrice(mint, holding.symbol),
          weightBps: Bps.make(value === BigInt(0) ? 0 : Number(holding.value * BigInt(10_000) / value)),
          change24h: dayChange(holding.symbol)
        })
      ),
      change24h: value / BigInt(80),
      asOf: mint.at(0)
    })
  )
}

/** Prices of `symbols`: one stock, several, or none. */
export const getPrices = (mint: Mint, symbols: ReadonlyArray<StockSymbol>): Beat =>
  read(mint, "getPrices", { symbols }, GetPrices.successSchema, symbols.map((symbol) => stockOf(mint, symbol, true)))

/** One stock; `priced: false` when its price isn't available. */
export const getStock = (mint: Mint, symbol: StockSymbol, priced = true): Beat =>
  read(mint, "getStock", { symbol }, GetStock.successSchema, stockOf(mint, symbol, priced))

/** The last `count` trades (none: "Nothing yet"). */
export const getActivity = (mint: Mint, count: number): Beat =>
  read(
    mint,
    "getActivity",
    { kind: "trades", period: "7d" },
    GetActivity.successSchema,
    Array.from({ length: count }, (_, index) => {
      const symbol = mint.cast.holdings[index % Math.max(1, mint.cast.holdings.length)]?.symbol ?? "AAPL"
      const at = mint.at(6 + index * 20)
      return {
        _tag: "Trade" as const,
        trade: new Trade({
          id: mint.id("trade") as TradeId,
          agentId: mint.cast.agents[0]?.id ?? null,
          symbol,
          side: index % 3 === 2 ? "sell" : "buy",
          status: "filled",
          usdc: usdc(50),
          shares: sharesFor(usdc(50), priceOf(symbol)),
          price: priceOf(symbol),
          reference: priceOf(symbol),
          referenceStatus: "live",
          gapBps: 12,
          txHash: `0x${"ab".repeat(31)}${(index + 16).toString(16)}` as Trade["txHash"],
          createdAt: at,
          settledAt: DateTime.add(at, { seconds: 4 })
        })
      }
    })
  )

const COSTS = new Costs({ fees: BigInt(1_240_000), slippage: BigInt(380_000), gasWei: BigInt(21_000_000_000_000) })

const series = (mint: Mint, total: number) =>
  Array.from({ length: 7 }, (_, index) => {
    const day = DateTime.formatIsoDateUtc(mint.at((6 - index) * 24))
    const unrealised = BigInt(Math.round(total * (index + 1) / 7 * 1e6))
    return new PnlPoint({ day, realised: BigInt(0), unrealised, total: unrealised })
  })

/** How the whole portfolio did: `gain` dollars, by stock and by agent; `empty` for an account that hasn't traded. */
export const getPerformance = (mint: Mint, gain: number, empty = false): Beat => {
  const stocks = (empty ? [] : mint.cast.holdings).map((holding) => {
    const count = shares(holding.shares)
    const value = valueOf(count, priceOf(holding.symbol))
    const cost = usdc(holding.shares * holding.costPerShare)
    return new StockLine({
      symbol: holding.symbol,
      shares: count,
      cost,
      value,
      realised: BigInt(0),
      unrealised: value - cost
    })
  })
  return read(
    mint,
    "getPerformance",
    { period: "7d" },
    GetPerformance.successSchema,
    new PortfolioPerformance({
      realised: BigInt(Math.round(gain * 0.2e6)),
      unrealised: BigInt(Math.round(gain * 0.8e6)),
      cost: Usdc.make(stocks.reduce((sum, line) => sum + line.cost, BigInt(0))),
      value: Usdc.make(stocks.reduce((sum, line) => sum + line.value, BigInt(0))),
      costs: COSTS,
      trades: empty ? 0 : 14,
      flagged: 0,
      series: empty ? [] : series(mint, gain),
      stocks,
      agents: (empty ? [] : mint.cast.agents.slice(0, 3)).map((agent, index) =>
        new AgentLine({
          agentId: agent.id,
          name: agent.name,
          realised: BigInt(0),
          unrealised: BigInt(Math.round(gain / (index + 2) * 1e6)),
          costs: COSTS,
          trades: 4 + index
        })
      )
    })
  )
}

export const getStockPerformance = (mint: Mint, symbol: StockSymbol, gain: number): Beat =>
  read(
    mint,
    "getStockPerformance",
    { symbol },
    GetStockPerformance.successSchema,
    new StockPerformance({
      symbol,
      shares: shares(4),
      cost: usdc(600),
      value: usdc(600 + gain),
      realised: BigInt(0),
      unrealised: BigInt(Math.round(gain * 1e6)),
      costs: COSTS,
      trades: 5,
      lots: [],
      series: series(mint, gain)
    })
  )

/** What an agent contributed: `gain` dollars over `trades` trades (none: it hasn't traded yet). */
export const getAgentPerformance = (mint: Mint, agentId: AgentId, gain: number, trades = 9): Beat =>
  read(
    mint,
    "getAgentPerformance",
    { agentId },
    GetAgentPerformance.successSchema,
    new AgentPerformance({
      agentId,
      realised: BigInt(Math.round(gain * 0.3e6)),
      unrealised: BigInt(Math.round(gain * 0.7e6)),
      bought: usdc(trades === 0 ? 0 : 450),
      sold: usdc(trades === 0 ? 0 : 60),
      costs: COSTS,
      trades,
      decided: trades === 0 ? 0 : trades + 3,
      blocked: trades === 0 ? 0 : 3,
      blockedBy: trades === 0 ?
        [] :
        [new BlockedBy({ policy: "stockCap", count: 2 }), new BlockedBy({ policy: "tradeSize", count: 1 })],
      series: trades === 0 ? [] : series(mint, gain),
      drift: null
    })
  )

export const getAutomationPerformance = (mint: Mint, automationId: AutomationId, runs: number): Beat =>
  read(
    mint,
    "getAutomationPerformance",
    { automationId },
    GetAutomationPerformance.successSchema,
    new AutomationPerformance({
      automationId,
      runs,
      // Every run but one traded; the other found nothing to do.
      outcomes: runs === 0 ? [] : [
        new RunCount({ result: "traded", count: runs - 1 }),
        new RunCount({ result: "skipped", count: 1 })
      ],
      trades: Math.max(0, runs - 1),
      bought: usdc(50 * Math.max(0, runs - 1)),
      sold: usdc(0),
      realised: BigInt(0),
      costs: COSTS,
      lastRunAt: runs === 0 ? null : mint.at(30)
    })
  )

export const getStockFacts = (mint: Mint, symbol: StockSymbol): Beat =>
  read(
    mint,
    "getStockFacts",
    { symbol },
    GetStockFacts.successSchema,
    new StockFacts({
      symbol,
      name: nameOf(symbol),
      token: TOKEN,
      feed: FEED,
      pool: { address: TOKEN, tickSpacing: 100 },
      facts: `${nameOf(symbol)} on Base is a token backed one for one by the share, priced by Chainlink.`,
      url: `${baseDeployment.explorerUrl}/token/${TOKEN}`
    })
  )
