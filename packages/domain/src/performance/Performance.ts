/**
 * How you're doing: profit and loss (realised by sales, unrealised on what you hold), what trading cost, and what
 * each stock, agent and automation contributed, from the ledger's lots and daily rows. Amounts are USDC base units;
 * profits, losses and slippage are signed; gas is in wei of ETH.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { RunResult } from "../automations/Run.ts"
import { AgentId, AutomationId } from "../Ids.ts"
import { StockSymbol } from "../market/Market.ts"
import { Shares, Usdc } from "../market/Units.ts"
import { PolicyId } from "../policies/AgentSpec.ts"

/**
 * What trades cost beyond the stock: the pools' fees and slippage against Chainlink (USDC base units, slippage
 * negative when fills beat it), and gas paid (wei).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Costs extends Schema.Class<Costs>("@bluechip/domain/performance/Performance/Costs")({
  fees: Schema.BigInt,
  slippage: Schema.BigInt,
  gasWei: Schema.BigInt
}) {}

/**
 * One day of a profit chart: realised so far, unrealised at the day's last measurement, and both.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PnlPoint extends Schema.Class<PnlPoint>("@bluechip/domain/performance/Performance/PnlPoint")({
  /** A UTC day, `2026-11-27`. */
  day: Schema.String,
  realised: Schema.BigInt,
  unrealised: Schema.BigInt,
  total: Schema.BigInt
}) {}

/**
 * Shares of a stock bought together and still held (in part or whole): what they cost, and who bought them.
 * `flagged` lots arrived outside bluechip and cost what the market price was when they were found.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class HeldLot extends Schema.Class<HeldLot>("@bluechip/domain/performance/Performance/HeldLot")({
  symbol: StockSymbol,
  agentId: Schema.NullOr(AgentId),
  shares: Shares,
  cost: Usdc,
  remaining: Shares,
  remainingCost: Usdc,
  openedAt: Schema.DateTimeUtc,
  flagged: Schema.Boolean
}) {}

/**
 * One stock's results: what you hold and what it cost (FIFO), its value now, profit realised and unrealised, costs,
 * trades, the lots still held (oldest first) and its profit by day.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class StockPerformance
  extends Schema.Class<StockPerformance>("@bluechip/domain/performance/Performance/StockPerformance")({
    symbol: StockSymbol,
    shares: Shares,
    cost: Usdc,
    /** At the market price; zero while the stock has none. */
    value: Usdc,
    realised: Schema.BigInt,
    unrealised: Schema.BigInt,
    costs: Costs,
    trades: Schema.Int,
    lots: Schema.Array(HeldLot),
    series: Schema.Array(PnlPoint)
  })
{}

/**
 * A stock's line in the portfolio's results.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class StockLine extends Schema.Class<StockLine>("@bluechip/domain/performance/Performance/StockLine")({
  symbol: StockSymbol,
  shares: Shares,
  cost: Usdc,
  value: Usdc,
  realised: Schema.BigInt,
  unrealised: Schema.BigInt
}) {}

/**
 * An agent's line in the portfolio's results: what it realised and holds unrealised, and what its trades cost.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AgentLine extends Schema.Class<AgentLine>("@bluechip/domain/performance/Performance/AgentLine")({
  agentId: AgentId,
  name: Schema.String,
  realised: Schema.BigInt,
  unrealised: Schema.BigInt,
  costs: Costs,
  trades: Schema.Int
}) {}

/**
 * The whole portfolio's results: profit realised and unrealised, what the stocks held cost and are worth, costs,
 * trades, the profit chart, and each stock's and agent's lines (biggest value first; agents by contribution).
 * `flagged` counts the balances found outside bluechip's trades (opening balances, transfers, differences).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PortfolioPerformance
  extends Schema.Class<PortfolioPerformance>("@bluechip/domain/performance/Performance/PortfolioPerformance")({
    realised: Schema.BigInt,
    unrealised: Schema.BigInt,
    cost: Usdc,
    value: Usdc,
    costs: Costs,
    trades: Schema.Int,
    flagged: Schema.Int,
    series: Schema.Array(PnlPoint),
    stocks: Schema.Array(StockLine),
    agents: Schema.Array(AgentLine)
  })
{}

/**
 * A rebalancing agent's distance from its target mix at a moment, in basis points.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class DriftPoint extends Schema.Class<DriftPoint>("@bluechip/domain/performance/Performance/DriftPoint")({
  at: Schema.DateTimeUtc,
  driftBps: Schema.Int,
  triggerBps: Schema.Int
}) {}

/**
 * How often a policy refused one agent's trades.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class BlockedBy extends Schema.Class<BlockedBy>("@bluechip/domain/performance/Performance/BlockedBy")({
  policy: PolicyId,
  count: Schema.Int
}) {}

/**
 * One agent's contribution: profit it realised (its sales) and holds unrealised (the lots it bought), what it bought
 * and sold, its costs, how many of its trades were decided and how many its policies blocked (by policy), its profit
 * by day and, for an agent with a target mix, its drift over the last 30 days (oldest first).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AgentPerformance
  extends Schema.Class<AgentPerformance>("@bluechip/domain/performance/Performance/AgentPerformance")({
    agentId: AgentId,
    realised: Schema.BigInt,
    unrealised: Schema.BigInt,
    bought: Usdc,
    sold: Usdc,
    costs: Costs,
    trades: Schema.Int,
    decided: Schema.Int,
    blocked: Schema.Int,
    blockedBy: Schema.Array(BlockedBy),
    series: Schema.Array(PnlPoint),
    drift: Schema.NullOr(Schema.Array(DriftPoint))
  })
{}

/**
 * How many of an automation's runs came to one result.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class RunCount extends Schema.Class<RunCount>("@bluechip/domain/performance/Performance/RunCount")({
  result: RunResult,
  count: Schema.Int
}) {}

/**
 * One automation's results: its runs by result, the trades its intents filled, what they bought and sold, the profit
 * its sales realised and what they cost.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AutomationPerformance
  extends Schema.Class<AutomationPerformance>("@bluechip/domain/performance/Performance/AutomationPerformance")({
    automationId: AutomationId,
    runs: Schema.Int,
    outcomes: Schema.Array(RunCount),
    trades: Schema.Int,
    bought: Usdc,
    sold: Usdc,
    realised: Schema.BigInt,
    costs: Costs,
    lastRunAt: Schema.NullOr(Schema.DateTimeUtc)
  })
{}
