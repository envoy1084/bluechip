/**
 * Who a tool acts for, provided by each surface for every call (the web chat per run, later chat platforms and MCP
 * clients), and what a tool tells the model when it can't do what was asked.
 *
 * @since 0.0.0
 */
import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import type { Address, ConversationId, UserId } from "../Ids.ts"
import type { IntentSource } from "../intents/Intent.ts"

/**
 * The user a tool call acts for, the conversation its cards belong to (`null` outside a conversation), and the source
 * the intents it creates carry.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class Caller extends Context.Service<Caller, {
  readonly id: UserId
  readonly account: Address
  readonly conversationId: ConversationId | null
  readonly source: IntentSource
}>()("@bluechip/domain/tools/Caller") {}

/**
 * A tool's refusal, in words for the model: an agent that doesn't exist, a spec with problems, a trade that can't be
 * quoted. The model explains it; nothing happened.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class ToolProblem extends Schema.Class<ToolProblem>("@bluechip/domain/tools/Caller/ToolProblem")({
  problem: Schema.String
}) {}
