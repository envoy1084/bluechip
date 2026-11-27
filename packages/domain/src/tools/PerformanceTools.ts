/**
 * Read tools over how you're doing: profit and loss, costs, and what each stock, agent and automation contributed,
 * from the ledger.
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"
import * as Schema from "effect/Schema"
import { StockSymbol } from "../market/Market.ts"
import {
  AgentPerformance,
  AutomationPerformance,
  type Costs,
  PortfolioPerformance,
  StockPerformance
} from "../performance/Performance.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { AgentIdParam, AutomationIdParam } from "./Params.ts"
import { Risk } from "./Risk.ts"
import { say, shares, usd } from "./Words.ts"

const signed = (amount: bigint) => (amount < BigInt(0) ? `−${usd(-amount)}` : `+${usd(amount)}`)

const eth = (wei: bigint) => `${(Number(wei) / 1e18).toFixed(6)} ETH`

const costLine = (costs: Costs) =>
  `Costs: ${usd(costs.fees)} in pool fees, ${signed(costs.slippage)} of slippage against Chainlink, ` +
  `${eth(costs.gasWei)} of gas.`

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetPerformance = Tool.make("getPerformance", {
  description:
    "How the user is doing overall, from bluechip's ledger (FIFO cost basis): profit realised by sales and " +
    "unrealised on what they hold, what the stocks cost and are worth, trading costs, and each stock's and agent's " +
    "contribution.",
  success: PortfolioPerformance,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (performance) =>
    say([
      `Realised ${signed(performance.realised)}, unrealised ${signed(performance.unrealised)}: stocks cost ` +
      `${usd(performance.cost)}, worth ${usd(performance.value)} now, over ${performance.trades} trades.`,
      costLine(performance.costs),
      ...performance.stocks.map((line) =>
        `${line.symbol}: ${shares(line.shares)} shares, cost ${usd(line.cost)}, worth ${usd(line.value)}, ` +
        `realised ${signed(line.realised)}, unrealised ${signed(line.unrealised)}`
      ),
      ...performance.agents.map((line) =>
        `Agent ${line.name} (${line.agentId}): realised ${signed(line.realised)}, unrealised ` +
        `${signed(line.unrealised)}, ${line.trades} trades`
      ),
      ...(performance.flagged === 0 ?
        [] :
        [`${performance.flagged} balance changes came from outside bluechip and are valued at the market price.`])
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetStockPerformance = Tool.make("getStockPerformance", {
  description: "One stock's results for the user: shares held and their FIFO cost, value now, profit realised and " +
    "unrealised, costs and the lots still held.",
  parameters: Schema.Struct({ symbol: StockSymbol }),
  success: StockPerformance,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (stock) =>
    say([
      `${stock.symbol}: ${shares(stock.shares)} shares, cost ${usd(stock.cost)}, worth ${usd(stock.value)}; ` +
      `realised ${signed(stock.realised)}, unrealised ${signed(stock.unrealised)}, ${stock.trades} trades.`,
      costLine(stock.costs),
      `${stock.lots.length} lots held${stock.lots.some((lot) => lot.flagged) ? ", some found outside bluechip" : ""}.`
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetAgentPerformance = Tool.make("getAgentPerformance", {
  description: "What one agent contributed: profit its sales realised and its holdings hold unrealised, what it " +
    "bought and sold, its costs, how often its policies blocked it (by policy), and its drift from a target mix.",
  parameters: Schema.Struct({ agentId: AgentIdParam }),
  success: AgentPerformance,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (agent) =>
    say([
      `Realised ${signed(agent.realised)}, unrealised ${signed(agent.unrealised)}; bought ${usd(agent.bought)}, ` +
      `sold ${usd(agent.sold)} in ${agent.trades} trades.`,
      costLine(agent.costs),
      `Policies blocked ${agent.blocked} of ${agent.decided} decided trades` +
      (agent.blockedBy.length === 0
        ? "."
        : `: ${agent.blockedBy.map((row) => `${row.policy} ${row.count}`).join(", ")}.`),
      ...(agent.drift === null || agent.drift.length === 0 ?
        [] :
        [
          `Drift from its target mix now ${agent.drift.at(-1)!.driftBps / 100}% (rebalances at ` +
          `${agent.drift.at(-1)!.triggerBps / 100}%).`
        ])
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetAutomationPerformance = Tool.make("getAutomationPerformance", {
  description: "One automation's results: how often it ran and how each run ended, the trades it made, what they " +
    "bought and sold, the profit its sales realised and their costs.",
  parameters: Schema.Struct({ automationId: AutomationIdParam }),
  success: AutomationPerformance,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (automation) =>
    say([
      `${automation.runs} runs` +
      (automation.outcomes.length === 0 ?
        "" :
        ` (${automation.outcomes.map((row) => `${row.count} ${row.result}`).join(", ")})`) +
      `, ${automation.trades} trades: bought ${usd(automation.bought)}, sold ${usd(automation.sold)}, realised ` +
      `${signed(automation.realised)}.`,
      costLine(automation.costs)
    ])
}).annotate(Risk, "read")

/**
 * The performance tools, on their own: the server implements them apart from the rest of the toolkit.
 *
 * @stability unstable
 * @category toolkits
 * @since 0.0.0
 */
export const PerformanceToolkit = Toolkit.make(
  GetPerformance,
  GetStockPerformance,
  GetAgentPerformance,
  GetAutomationPerformance
)
