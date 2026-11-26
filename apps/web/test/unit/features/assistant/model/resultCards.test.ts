import { Card } from "@bluechip/domain/assistant/Card"
import { CardId } from "@bluechip/domain/Ids"
import { Shares } from "@bluechip/domain/market/Units"
import { Costs, StockPerformance } from "@bluechip/domain/performance/Performance"
import { ListAgents } from "@bluechip/domain/tools/AgentTools"
import { GetActivity, GetPortfolio, GetStock } from "@bluechip/domain/tools/MarketTools"
import { GetStockPerformance } from "@bluechip/domain/tools/PerformanceTools"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"
import { dailyBrief } from "../../../../../src/features/assistant/model/dailyBrief.ts"
import {
  type ResultCard,
  resultCardsOf,
  resultKind,
  resultState
} from "../../../../../src/features/assistant/model/resultCards.ts"
import { appleTrade } from "../../../../fixtures/Activity.ts"
import { agent, AGENT_ID } from "../../../../fixtures/Agents.ts"
import {
  buyOf,
  encoded,
  holdingOf,
  legIntent,
  portfolioOf,
  stockOf,
  toolRow,
  turnOf,
  usd
} from "../../../../fixtures/Results.ts"

const PORTFOLIO = portfolioOf(200, [holdingOf("NVDA", 800, 100)], 40)
const NVIDIA = stockOf("NVDA", "Nvidia", 100)
const NVIDIA_RESULTS = new StockPerformance({
  symbol: "NVDA",
  shares: Shares.make(BigInt(800_000_000)),
  cost: usd(700),
  value: usd(800),
  realised: BigInt(0),
  unrealised: usd(100),
  costs: new Costs({ fees: BigInt(0), slippage: BigInt(0), gasWei: BigInt(0) }),
  trades: 2,
  lots: [],
  series: []
})

describe("resultCardsOf", () => {
  it("a read still running shimmers", () => {
    assert.deepStrictEqual(resultCardsOf(turnOf([toolRow("call-1", "getPrices", "running")])), [
      { _tag: "Loading", id: "call-1", tool: "getPrices" }
    ])
  })

  it("a failed read says the problem it ran into", () => {
    const failed = toolRow("call-1", "getQuote", "failed", { _tag: "ToolProblem", problem: "Prices are paused." })
    assert.deepStrictEqual(resultCardsOf(turnOf([failed])), [
      { _tag: "Failed", id: "call-1", tool: "getQuote", problem: "Prices are paused." }
    ])
  })

  it("a failed read with no problem to say", () => {
    assert.deepStrictEqual(resultCardsOf(turnOf([toolRow("call-1", "getQuote", "failed", {})])), [
      { _tag: "Failed", id: "call-1", tool: "getQuote", problem: null }
    ])
  })

  it("a read decoded with its tool's schema, with the agent it was asked about", () => {
    const agents = [agent("active")]
    const row = toolRow("call-1", "listAgents", "done", encoded(ListAgents.successSchema, agents), {
      agentId: AGENT_ID
    })
    assert.deepStrictEqual(resultCardsOf(turnOf([row])), [
      { _tag: "Read", id: "call-1", read: { tool: "listAgents", value: agents }, agentId: AGENT_ID }
    ])
  })

  it.each([
    { name: "a tool whose answer is a card", row: toolRow("call-1", "proposeTrade", "done", {}) },
    { name: "a result that doesn't decode", row: toolRow("call-1", "getPrices", "done", { nope: true }) },
    { name: "a web search", row: toolRow("call-1", "AnthropicWebSearch", "running") }
  ])("no card for $name", ({ row }) => {
    assert.deepStrictEqual(resultCardsOf(turnOf([row])), [])
  })

  it("a stock read several ways is one card, where it was first read; another stock its own", () => {
    const cards = resultCardsOf(turnOf([
      toolRow("call-1", "getStock", "done", encoded(GetStock.successSchema, NVIDIA)),
      toolRow("call-2", "getStock", "done", encoded(GetStock.successSchema, stockOf("AAPL", "Apple", 190))),
      toolRow("call-3", "getStockPerformance", "done", encoded(GetStockPerformance.successSchema, NVIDIA_RESULTS))
    ]))
    assert.deepStrictEqual(cards, [
      {
        _tag: "Stock",
        id: "call-1",
        read: { symbol: "NVDA", stock: NVIDIA, facts: null, performance: NVIDIA_RESULTS }
      },
      {
        _tag: "Stock",
        id: "call-2",
        read: { symbol: "AAPL", stock: stockOf("AAPL", "Apple", 190), facts: null, performance: null }
      }
    ])
  })

  it("a portfolio read with the activity is the day's brief, with the trades waiting for you", () => {
    const waiting = legIntent(1, buyOf("NVDA", 400), "needsApproval")
    const activity = [appleTrade()]
    const cards = resultCardsOf(turnOf(
      [
        toolRow("call-1", "getActivity", "done", encoded(GetActivity.successSchema, activity)),
        toolRow("call-2", "getPortfolio", "done", encoded(GetPortfolio.successSchema, PORTFOLIO))
      ],
      [{
        toolCallId: null,
        card: { _tag: "Trade", id: CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v3w"), intent: waiting }
      }]
    ))
    assert.deepStrictEqual(cards, [{ _tag: "Brief", id: "call-2", brief: dailyBrief(PORTFOLIO, activity, [waiting]) }])
  })

  it("a rebalance is one plan of its cards' trades, with the portfolio the turn read", () => {
    const leg = legIntent(1, buyOf("NVDA", 50))
    const plan: ReadonlyArray<Card> = [{
      _tag: "Trade",
      id: CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v3w"),
      intent: leg
    }]
    const cards = resultCardsOf(turnOf([
      toolRow("call-1", "getPortfolio", "done", encoded(GetPortfolio.successSchema, PORTFOLIO)),
      toolRow("call-2", "proposeRebalance", "done", encoded(Schema.Array(Card), plan))
    ]))
    assert.deepStrictEqual(cards, [
      { _tag: "Read", id: "call-1", read: { tool: "getPortfolio", value: PORTFOLIO }, agentId: null },
      { _tag: "Rebalance", id: "call-2", legs: [leg], portfolio: PORTFOLIO }
    ])
  })
})

describe("resultState", () => {
  it.each<{ name: string; card: ResultCard; expected: ReturnType<typeof resultState> }>([
    { name: "running", card: { _tag: "Loading", id: "c", tool: "getPrices" }, expected: "loading" },
    { name: "failed", card: { _tag: "Failed", id: "c", tool: "getPrices", problem: null }, expected: "error" },
    {
      name: "prices of no stocks",
      card: { _tag: "Read", id: "c", read: { tool: "getPrices", value: [] }, agentId: null },
      expected: "empty"
    },
    {
      name: "prices of a stock",
      card: { _tag: "Read", id: "c", read: { tool: "getPrices", value: [NVIDIA] }, agentId: null },
      expected: "ready"
    },
    {
      name: "a portfolio with nothing in it",
      card: { _tag: "Read", id: "c", read: { tool: "getPortfolio", value: portfolioOf(0, []) }, agentId: null },
      expected: "empty"
    },
    {
      name: "a portfolio of cash only",
      card: { _tag: "Read", id: "c", read: { tool: "getPortfolio", value: portfolioOf(10, []) }, agentId: null },
      expected: "ready"
    },
    {
      name: "a stock without a price",
      card: {
        _tag: "Stock",
        id: "c",
        read: { symbol: "SPCX", stock: stockOf("SPCX", "SpaceX", null), facts: null, performance: null }
      },
      expected: "empty"
    },
    {
      name: "a stock without a price, with your results in it",
      card: {
        _tag: "Stock",
        id: "c",
        read: { symbol: "SPCX", stock: stockOf("SPCX", "SpaceX", null), facts: null, performance: NVIDIA_RESULTS }
      },
      expected: "ready"
    },
    {
      name: "a rebalance with nothing to trade",
      card: { _tag: "Rebalance", id: "c", legs: [], portfolio: null },
      expected: "empty"
    },
    {
      name: "a quiet day",
      card: { _tag: "Brief", id: "c", brief: dailyBrief(PORTFOLIO, [], []) },
      expected: "empty"
    }
  ])("$name", ({ card, expected }) => {
    assert.strictEqual(resultState(card), expected)
  })
})

describe("resultKind", () => {
  it.each<{ card: ResultCard; expected: ReturnType<typeof resultKind> }>([
    { card: { _tag: "Loading", id: "c", tool: "getAgentJournal" }, expected: "activity" },
    { card: { _tag: "Failed", id: "c", tool: "searchMemory", problem: null }, expected: "memories" },
    {
      card: { _tag: "Read", id: "c", read: { tool: "getPrices", value: [] }, agentId: null },
      expected: "prices"
    },
    { card: { _tag: "Rebalance", id: "c", legs: [], portfolio: null }, expected: "rebalance" }
  ])("$expected", ({ card, expected }) => {
    assert.strictEqual(resultKind(card), expected)
  })
})
