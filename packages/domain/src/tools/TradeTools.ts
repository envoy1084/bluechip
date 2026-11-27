/**
 * Propose tools: trades become intents, and the pipeline decides them. An agent within its policies sends its trade;
 * anything else waits for the user's Face ID or is blocked with the policy that refused it. The model never sends.
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { Card, describeCard } from "../assistant/Card.ts"
import { StockSymbol } from "../market/Market.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { AgentIdParam } from "./Params.ts"
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

// A plain string: a trimmed string's pattern held Anthropic's constrained decoding in a loop. Handlers trim it.
const Reason = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_REASON_LENGTH)).annotate({
  description: "Why, in a short sentence the user will read with the trade."
})

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ProposeTrade = Tool.make("proposeTrade", {
  description: "Proposes one trade, through an agent (its policies decide: it sends it, asks the user, or blocks it) " +
    "or as the user (prepared for their Face ID). Give dollars for a buy and shares for a sell. Returns the outcome: " +
    "being sent, waiting for the user's approval, blocked by a named policy and why, or waiting; a trade as the user " +
    "comes with its quote. Tell the user the trade, the outcome and what they need to do; never claim it happened " +
    "unless the result says so.",
  parameters: Schema.Struct({
    agentId: Schema.NullOr(AgentIdParam).annotate({
      description: "The agent to trade through; null to trade as the user."
    }),
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
}).annotate(Risk, "propose").annotate(Tool.Strict, true)

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ProposeRebalance = Tool.make("proposeRebalance", {
  description: "Proposes the trades that bring the portfolio back to a rebalancer agent's target mix, one intent per " +
    "stock that drifted past its trigger, each decided by the agent's policies. Returns each trade with its outcome: " +
    "tell the user what moves and what waits for them.",
  parameters: Schema.Struct({ agentId: AgentIdParam, reason: Reason }),
  success: Schema.Array(Card),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (cards) =>
    say(cards.length === 0 ? "Nothing has drifted past the trigger: no trades." : cards.map(describeCard))
}).annotate(Risk, "propose").annotate(Tool.Strict, true)
