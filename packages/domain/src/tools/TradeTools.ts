/**
 * Propose tools: trades become intents, and the pipeline decides them. An agent within its policies sends its trade;
 * anything else waits for the user's Face ID or is blocked with the policy that refused it. The model never sends.
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { Card, describeCard } from "../assistant/Card.ts"
import { AgentId } from "../Ids.ts"
import { StockSymbol } from "../market/Market.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { Risk } from "./Risk.ts"
import { say } from "./Words.ts"

/**
 * The longest reason a proposal carries.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MAX_REASON_LENGTH = 200

const Reason = Schema.Trimmed.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_REASON_LENGTH)).annotate({
  description: "Why, in a short sentence the user will read on the card."
})

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ProposeTrade = Tool.make("proposeTrade", {
  description: "Proposes one trade, through an agent (its policies decide: it sends it, asks the user, or blocks it) " +
    "or as the user (prepared for their Face ID). Give dollars for a buy and shares for a sell. The result is a card; " +
    "never claim a trade happened unless the card says so.",
  parameters: Schema.Struct({
    agentId: Schema.NullOr(AgentId).annotate({ description: "The agent to trade through; null to trade as the user." }),
    symbol: StockSymbol,
    side: Schema.Literals(["buy", "sell"]),
    dollars: Schema.NullOr(Schema.Finite).annotate({ description: "Dollars to spend on a buy; null for a sell." }),
    shares: Schema.NullOr(Schema.Finite).annotate({ description: "Shares to sell; null for a buy." }),
    reason: Reason
  }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (card) => say(describeCard(card))
}).annotate(Risk, "propose")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ProposeRebalance = Tool.make("proposeRebalance", {
  description: "Proposes the trades that bring the portfolio back to a rebalancer agent's target mix, one intent per " +
    "stock that drifted past its trigger, each decided by the agent's policies.",
  parameters: Schema.Struct({ agentId: AgentId, reason: Reason }),
  success: Schema.Array(Card),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (cards) =>
    say(cards.length === 0 ? "Nothing has drifted past the trigger: no trades." : cards.map(describeCard))
}).annotate(Risk, "propose")
