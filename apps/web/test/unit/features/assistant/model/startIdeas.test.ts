import { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { setDirection } from "@bluechip/domain/policies/SpecEdits"
import type { Direction } from "@bluechip/domain/policies/Trade"
import { assert, describe, it } from "@effect/vitest"
import {
  agentIdeas,
  agentRulesLine,
  type Situation,
  startIdeas
} from "../../../../../src/features/assistant/model/startIdeas.ts"
import { agent, PICKER } from "../../../../fixtures/Agents.ts"

const nameOf = (symbol: StockSymbol) => symbol === "NVDA" ? "Nvidia" : "Apple"

// The Nvidia picker (Nvidia and Apple, both ways, $100 a trade) trading `direction`, paused or not.
const picker = (direction: Direction, paused = false) =>
  new Agent({ ...agent("active", { paused }), spec: setDirection(PICKER, direction) })

describe("startIdeas", () => {
  it.each<{ name: string; situation: Situation; expected: ReadonlyArray<string> }>([
    {
      name: "no money yet: how to start",
      situation: { hasMoney: false, holdsStocks: false, agents: 0 },
      expected: [
        "How do I add money?",
        "What is bluechip?",
        "What can an agent do on its own?",
        "Create an agent that buys Apple every week"
      ]
    },
    {
      name: "money but nothing bought and no agent",
      situation: { hasMoney: true, holdsStocks: false, agents: 0 },
      expected: [
        "Buy $50 of Apple",
        "Create an agent that only rebalances",
        "Buy $50 of Apple every Monday",
        "What can an agent do on its own?"
      ]
    },
    {
      name: "stocks held, no agent",
      situation: { hasMoney: true, holdsStocks: true, agents: 0 },
      expected: [
        "Buy $50 of Apple",
        "Create an agent that only rebalances",
        "Buy $50 of Apple every Monday",
        "How did I do this week?"
      ]
    },
    {
      name: "one agent, nothing bought yet",
      situation: { hasMoney: true, holdsStocks: false, agents: 1 },
      expected: [
        "What did my agent do today?",
        "Buy $50 of Apple",
        "Create an agent that only rebalances",
        "Buy $50 of Apple every Monday"
      ]
    },
    {
      name: "two agents and stocks held",
      situation: { hasMoney: true, holdsStocks: true, agents: 2 },
      expected: [
        "What did my agents do today?",
        "How did I do this week?",
        "Create an agent that only rebalances",
        "Buy $50 of Apple every Monday"
      ]
    }
  ])("$name", ({ expected, situation }) => {
    assert.deepStrictEqual(startIdeas(situation).map((idea) => idea.ask), expected)
  })
})

describe("agentIdeas", () => {
  it.each<{ name: string; agent: Agent; expected: ReadonlyArray<string> }>([
    {
      name: "one that buys: a buy of its first stock",
      agent: picker("buy"),
      expected: [
        "What has this agent done this week?",
        "Buy $50 of Nvidia",
        "Add an automation to this agent",
        "Pause this agent"
      ]
    },
    {
      name: "one that only sells: a sell",
      agent: picker("sell"),
      expected: [
        "What has this agent done this week?",
        "Sell $50 of Nvidia",
        "Add an automation to this agent",
        "Pause this agent"
      ]
    },
    {
      name: "a rebalancer: back to its targets",
      agent: picker("rebalance"),
      expected: [
        "What has this agent done this week?",
        "Bring my mix back to its targets",
        "Add an automation to this agent",
        "Pause this agent"
      ]
    },
    {
      name: "a paused one: resume it",
      agent: picker("both", true),
      expected: [
        "What has this agent done this week?",
        "Buy $50 of Nvidia",
        "Add an automation to this agent",
        "Resume this agent"
      ]
    }
  ])("$name", ({ agent: shown, expected }) => {
    assert.deepStrictEqual(agentIdeas(shown, nameOf).map((idea) => idea.ask), expected)
  })
})

describe("agentRulesLine", () => {
  it.each<{ name: string; agent: Agent; expected: string }>([
    { name: "buys", agent: picker("buy"), expected: "Buys Nvidia and Apple, up to $100 a trade on its own." },
    {
      name: "buys and sells",
      agent: picker("both"),
      expected: "Buys and sells Nvidia and Apple, up to $100 a trade on its own."
    },
    { name: "sells", agent: picker("sell"), expected: "Sells Nvidia and Apple, up to $100 a trade on its own." }
  ])("$name", ({ agent: shown, expected }) => {
    assert.strictEqual(agentRulesLine(shown, nameOf), expected)
  })
})
