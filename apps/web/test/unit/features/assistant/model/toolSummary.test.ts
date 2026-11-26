import { Agent } from "@bluechip/domain/agents/Agent"
import { Intent } from "@bluechip/domain/intents/Intent"
import { catalogInfo } from "@bluechip/domain/policies/Catalog"
import { templateInfos } from "@bluechip/domain/policies/Templates"
import { ListPolicies, ListTemplates } from "@bluechip/domain/tools/PolicyTools"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"
import { toolSummary } from "../../../../../src/features/assistant/model/toolSummary.ts"
import { agent, SAVED } from "../../../../fixtures/Agents.ts"
import { nvidiaBuy } from "../../../../fixtures/Intents.ts"

// Results arrive as their tools encode them: JSON, with amounts as strings and times as ISO dates.
const NVIDIA = {
  symbol: "NVDA",
  name: "Nvidia",
  token: "0x0000000000000000000000000000000000000001",
  tradable: true,
  logoUrl: null,
  price: { symbol: "NVDA", price: "15204000000", tradedAt: "2026-11-26T15:00:00.000Z", previousClose: null },
  reference: null,
  change24h: 120
}
const APPLE = { ...NVIDIA, symbol: "AAPL", name: "Apple", price: null }

const trade = (id: string) => ({
  _tag: "Trade",
  trade: {
    id,
    symbol: "NVDA",
    side: "buy",
    status: "filled",
    usdc: "50000000",
    shares: "32886000",
    price: "15204000000",
    reference: "15200000000",
    referenceStatus: "live",
    gapBps: 3,
    txHash: null,
    createdAt: "2026-11-26T15:00:00.000Z",
    settledAt: "2026-11-26T15:00:05.000Z"
  }
})

const WITHDRAWAL = {
  _tag: "Withdrawal",
  transfer: {
    id: "transfer_01jd8v4t5m6n7p8q9r0s1t2v3w",
    kind: "withdrawal",
    asset: "USDC",
    amount: "25000000",
    from: "0x0000000000000000000000000000000000000003",
    to: "0x0000000000000000000000000000000000000004",
    status: "confirmed",
    txHash: null,
    createdAt: "2026-11-26T15:00:00.000Z"
  }
}

const agentJson = Schema.encodeSync(Schema.toCodecJson(Agent))(agent("active"))
const intentJson = Schema.encodeSync(Schema.toCodecJson(Intent))(nvidiaBuy("2026-11-26T10:00:00Z"))
const problem = { policy: "trade", field: "stocks", message: "Pick at least one stock." }
const memory = {
  id: "memory_01jd8v4t5m6n7p8q9r0s1t2v3w",
  agentId: null,
  kind: "preference",
  text: "You like Nvidia.",
  source: "said",
  confidence: 1,
  note: null,
  messageId: null,
  confirmedAt: "2026-11-26T10:00:00.000Z",
  createdAt: "2026-11-26T10:00:00.000Z",
  lastUsedAt: null
}

describe("toolSummary", () => {
  it.each<{ name: string; tool: string; result: unknown; expected: string | null }>([
    {
      name: "the portfolio: its total",
      tool: "getPortfolio",
      result: {
        cash: "1000000000",
        invested: "234560000",
        value: "1234560000",
        holdings: [],
        change24h: "-1000000",
        asOf: "2026-11-26T15:00:00.000Z"
      },
      expected: "$1,234.56"
    },
    { name: "one price: the stock and its price", tool: "getPrices", result: [NVIDIA], expected: "Nvidia $152.04" },
    { name: "one stock without a price", tool: "getPrices", result: [APPLE], expected: "Apple, no price" },
    { name: "several prices: how many", tool: "getPrices", result: [NVIDIA, APPLE], expected: "2 stocks" },
    { name: "no prices", tool: "getPrices", result: [], expected: "No stocks" },
    { name: "one stock: its price", tool: "getStock", result: NVIDIA, expected: "Nvidia $152.04" },
    {
      name: "a quote: the price a share",
      tool: "getQuote",
      result: {
        symbol: "NVDA",
        side: "buy",
        usdc: "100000000",
        shares: "65772164",
        price: "15204000000",
        reference: {
          symbol: "NVDA",
          price: "15200000000",
          updatedAt: "2026-11-26T15:00:00.000Z",
          status: "live"
        },
        gapBps: 3,
        minimumOut: "65443303",
        pool: "0x0000000000000000000000000000000000000002",
        quotedAt: "2026-11-26T15:00:00.000Z",
        expiresAt: "2026-11-26T15:00:30.000Z"
      },
      expected: "$152.04 a share"
    },
    { name: "no activity", tool: "getActivity", result: [], expected: "Nothing yet" },
    {
      name: "one trade",
      tool: "getActivity",
      result: [trade("trade_01jd8v4t5m6n7p8q9r0s1t2v3w")],
      expected: "1 trade"
    },
    {
      name: "several trades",
      tool: "getActivity",
      result: [trade("trade_01jd8v4t5m6n7p8q9r0s1t2v3w"), trade("trade_01jd8v4t5m6n7p8q9r0s1t2v3x")],
      expected: "2 trades"
    },
    { name: "one withdrawal", tool: "getActivity", result: [WITHDRAWAL], expected: "1 withdrawal" },
    {
      name: "trades and withdrawals",
      tool: "getActivity",
      result: [
        trade("trade_01jd8v4t5m6n7p8q9r0s1t2v3w"),
        trade("trade_01jd8v4t5m6n7p8q9r0s1t2v3x"),
        WITHDRAWAL,
        { ...WITHDRAWAL, transfer: { ...WITHDRAWAL.transfer, id: "transfer_01jd8v4t5m6n7p8q9r0s1t2v3x" } }
      ],
      expected: "2 trades and 2 withdrawals"
    },
    { name: "no agents", tool: "listAgents", result: [], expected: "No agents yet" },
    { name: "one agent", tool: "listAgents", result: [agentJson], expected: "1 agent" },
    { name: "several agents", tool: "listAgents", result: [agentJson, agentJson], expected: "2 agents" },
    {
      name: "an agent: its name",
      tool: "getAgent",
      result: { agent: agentJson, description: { can: [], never: [] } },
      expected: "Nvidia picker"
    },
    {
      name: "an agent's history without trades",
      tool: "getAgentHistory",
      result: { sessions: [], intents: [] },
      expected: "No trades yet"
    },
    {
      name: "an agent's history: its trades",
      tool: "getAgentHistory",
      result: { sessions: [], intents: [intentJson] },
      expected: "1 trade"
    },
    {
      name: "the catalog: the policies people see",
      tool: "listPolicies",
      result: Schema.encodeSync(Schema.toCodecJson(ListPolicies.successSchema))(catalogInfo()),
      expected: "9 policies"
    },
    {
      name: "templates: built-in and saved",
      tool: "listTemplates",
      result: Schema.encodeSync(Schema.toCodecJson(ListTemplates.successSchema))({
        builtIn: templateInfos(),
        saved: [SAVED]
      }),
      expected: "5 templates"
    },
    {
      name: "a check without problems",
      tool: "checkAgentSpec",
      result: { problems: [], description: { can: [], never: [] }, changes: null },
      expected: "No problems"
    },
    {
      name: "a check with one problem",
      tool: "checkAgentSpec",
      result: { problems: [problem], description: { can: [], never: [] }, changes: null },
      expected: "1 problem"
    },
    {
      name: "a check with several problems",
      tool: "checkAgentSpec",
      result: { problems: [problem, problem], description: { can: [], never: [] }, changes: null },
      expected: "2 problems"
    },
    { name: "no memories", tool: "listMemories", result: [], expected: "Nothing yet" },
    { name: "one memory", tool: "listMemories", result: [memory], expected: "1 memory" },
    { name: "a rebalance with nothing drifted", tool: "proposeRebalance", result: [], expected: "Nothing to trade" },
    { name: "a tool answering with a card: nothing", tool: "draftAgent", result: {}, expected: null },
    { name: "web research: nothing", tool: "AnthropicWebSearch", result: [], expected: null },
    { name: "an unknown tool: nothing", tool: "later", result: [], expected: null },
    { name: "a result that doesn't decode: nothing", tool: "getPortfolio", result: { value: 12 }, expected: null },
    { name: "no result: nothing", tool: "listAgents", result: null, expected: null }
  ])("$name", ({ expected, result, tool }) => {
    assert.strictEqual(toolSummary(tool, result), expected)
  })
})
