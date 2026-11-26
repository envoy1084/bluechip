/**
 * Knowledge tools: bluechip's help articles and its stocks' facts, to answer from and cite.
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { Passage, StockFacts } from "../knowledge/Knowledge.ts"
import { StockSymbol } from "../market/Market.ts"
import { ToolProblem } from "./Caller.ts"
import { Risk } from "./Risk.ts"
import { say } from "./Words.ts"

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const SearchHelp = Tool.make("searchHelp", {
  description: "Searches bluechip's help center and stock facts: how agents, policies, approvals, automations, gas, " +
    "funding, trading, memory and recovery work. Answer questions about bluechip from what it returns, and cite " +
    "the article and section you used (its title and link).",
  parameters: Schema.Struct({
    query: Schema.String.annotate({ description: "The question, or a few words of it: 'who pays gas'." })
  }),
  success: Schema.Array(Passage),
  failure: ToolProblem,
  failureMode: "return",
  toModelOutput: (passages) =>
    say(
      passages.length === 0 ?
        "Nothing in bluechip's help answers that." :
        passages.map((passage, index) =>
          `[${index + 1}] ${passage.citation.title}${
            passage.citation.section === null ? "" : `, ${passage.citation.section}`
          } (${passage.citation.url}):\n${passage.text}`
        ).join("\n\n")
    )
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetStockFacts = Tool.make("getStockFacts", {
  description: "A stock's facts onchain: its token on Base, the Chainlink feed bluechip prices it with, and the pool " +
    "it trades in. Use getStock for its price.",
  parameters: Schema.Struct({ symbol: StockSymbol }),
  success: StockFacts,
  failure: ToolProblem,
  failureMode: "return",
  toModelOutput: (facts) => say(`${facts.facts} Explorer: ${facts.url}`)
}).annotate(Risk, "read")
