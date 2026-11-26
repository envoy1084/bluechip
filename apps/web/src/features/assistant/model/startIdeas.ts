// What the chat's start screen offers: ideas that fit where you are (no money yet, money but no agent, agents at
// work), and, with an agent picked, ideas within what that agent trades and which way.
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { listNames } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import type { IconName } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface StartIdea {
  readonly icon: IconName
  readonly ask: string
  readonly hint: string
}

/** Where you are: money in the account, stocks held, and your agents that haven't been removed. */
export interface Situation {
  readonly hasMoney: boolean
  readonly holdsStocks: boolean
  readonly agents: number
}

const AUTOMATION: StartIdea = {
  icon: "zap",
  ask: "Buy $50 of Apple every Monday",
  hint: "An automation from one sentence"
}

/** Ideas for a chat about your own account, from what you have so far. */
export const startIdeas = ({ agents, hasMoney, holdsStocks }: Situation): ReadonlyArray<StartIdea> => {
  if (!hasMoney) {
    return [
      { icon: "wallet", ask: "How do I add money?", hint: "USDC on Base, ready in minutes" },
      { icon: "help", ask: "What is bluechip?", hint: "Stocks, agents and Face ID in a minute" },
      { icon: "shield", ask: "What can an agent do on its own?", hint: "And what always waits for you" },
      { icon: "agents", ask: "Create an agent that buys Apple every week", hint: "Set it up now, fund it later" }
    ]
  }

  if (agents === 0) {
    return [
      { icon: "stocks", ask: "Buy $50 of Apple", hint: "With your Face ID" },
      { icon: "agents", ask: "Create an agent that only rebalances", hint: "Set a target mix in words" },
      AUTOMATION,
      holdsStocks ?
        { icon: "portfolio", ask: "How did I do this week?", hint: "Profit by stock" } :
        { icon: "shield", ask: "What can an agent do on its own?", hint: "And what always waits for you" }
    ]
  }

  const yours = agents === 1 ? "my agent" : "my agents"
  return [
    { icon: "activity", ask: `What did ${yours} do today?`, hint: "Trades, refusals and approvals" },
    holdsStocks ?
      { icon: "portfolio", ask: "How did I do this week?", hint: "Profit by stock and by agent" } :
      { icon: "stocks", ask: "Buy $50 of Apple", hint: "With your Face ID" },
    { icon: "agents", ask: "Create an agent that only rebalances", hint: "Set a target mix in words" },
    AUTOMATION
  ]
}

const dollars = (units: bigint) => formatMoney(usdcDollars(units)).replace(/\.00$/u, "")

/** Ideas for a chat about `agent`: a trade it may make (its first stock, its direction), its week, its automations. */
export const agentIdeas = (agent: Agent, nameOf: (symbol: StockSymbol) => string): ReadonlyArray<StartIdea> => {
  const trading = configOf(agent.spec.policies, trade)
  const first = trading?.stocks[0]
  const name = first === undefined ? null : nameOf(first)
  const tradeIdea: StartIdea | null = trading === undefined || name === null ?
    null :
    trading.direction === "sell" ?
    { icon: "stocks", ask: `Sell $50 of ${name}`, hint: "Through its rules" } :
    trading.direction === "rebalance" ?
    { icon: "scales", ask: "Bring my mix back to its targets", hint: "Through its rules" } :
    { icon: "stocks", ask: `Buy $50 of ${name}`, hint: "Through its rules" }

  return [
    { icon: "activity", ask: "What has this agent done this week?", hint: "Its trades and why" },
    ...(tradeIdea === null ? [] : [tradeIdea]),
    { icon: "zap", ask: "Add an automation to this agent", hint: "On a schedule, a price or the news" },
    agent.paused ?
      { icon: "play", ask: "Resume this agent", hint: "It trades again within its rules" } :
      { icon: "pause", ask: "Pause this agent", hint: "Nothing trades until you resume" }
  ]
}

const DIRECTION = { buy: "Buys", sell: "Sells", both: "Buys and sells", rebalance: "Keeps your mix of" } as const

/** `agent`'s rules in one line: "Buys Apple and Nvidia, up to $100 a trade on its own." */
export const agentRulesLine = (agent: Agent, nameOf: (symbol: StockSymbol) => string): string => {
  const trading = configOf(agent.spec.policies, trade)
  const size = configOf(agent.spec.policies, tradeSize)
  if (trading === undefined || trading.stocks.length === 0) return "It trades nothing yet."

  const what = `${DIRECTION[trading.direction]} ${listNames(trading.stocks.map(nameOf))}`
  return size === undefined ? `${what}.` : `${what}, up to ${dollars(size.maxPerTrade)} a trade on its own.`
}
