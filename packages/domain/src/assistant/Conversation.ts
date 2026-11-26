/**
 * Conversations with the assistant and their messages, stored by bluechip (never taken from the client), as typed
 * parts: what was said, the tools the model called and what they returned, and the cards they showed.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { AgentId, ConversationId, MessageId } from "../Ids.ts"
import { Card } from "./Card.ts"

/**
 * Text: the user's words, or the assistant's.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TextPart = Schema.Struct({ type: Schema.Literal("text"), text: Schema.String })

/**
 * The model's thinking, kept with its provider options (its signature) so later turns send it back unchanged. Not
 * shown.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ReasoningPart = Schema.Struct({
  type: Schema.Literal("reasoning"),
  text: Schema.String,
  options: Schema.Record(Schema.String, Schema.Unknown)
})

/**
 * A tool the model called, with its parameters as the model sent them. `providerExecuted` for tools Anthropic runs
 * (web search).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ToolCallPart = Schema.Struct({
  type: Schema.Literal("toolCall"),
  id: Schema.String,
  name: Schema.String,
  params: Schema.Unknown,
  providerExecuted: Schema.Boolean
})

/**
 * What a tool returned, JSON-encoded with the tool's success (or failure) schema, and the words the model was given
 * in its place, if any.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ToolResultPart = Schema.Struct({
  type: Schema.Literal("toolResult"),
  id: Schema.String,
  name: Schema.String,
  result: Schema.Unknown,
  isFailure: Schema.Boolean,
  providerExecuted: Schema.Boolean,
  modelOutput: Schema.NullOr(Schema.String)
})

/**
 * A card the conversation showed, as it is now (its status follows confirmations).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const CardPart = Schema.Struct({
  type: Schema.Literal("card"),
  /** The tool call that made it; `null` for cards the assistant made itself (memories, research, errors). */
  toolCallId: Schema.NullOr(Schema.String),
  card: Card
})

/**
 * The model failed, and the turn ended without an answer.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ErrorPart = Schema.Struct({ type: Schema.Literal("error"), message: Schema.String })

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const MessagePart = Schema.Union([TextPart, ReasoningPart, ToolCallPart, ToolResultPart, CardPart, ErrorPart])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type MessagePart = typeof MessagePart.Type

/**
 * One message: the user's, or one model round of the assistant's (its text, tool calls, results and cards).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Message extends Schema.Class<Message>("@bluechip/domain/assistant/Conversation/Message")({
  id: MessageId,
  role: Schema.Literals(["user", "assistant"]),
  parts: Schema.Array(MessagePart),
  /** The model that wrote it; `null` for yours. */
  model: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * Where a conversation happens: the web app, or a linked Telegram chat.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Surface = Schema.Literals(["web", "telegram"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Surface = typeof Surface.Type

/**
 * The longest message you can send, in characters.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MAX_MESSAGE_LENGTH = 4000

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Conversation extends Schema.Class<Conversation>("@bluechip/domain/assistant/Conversation/Conversation")({
  id: ConversationId,
  /** The agent the conversation is about, when it started from one. */
  agentId: Schema.NullOr(AgentId),
  surface: Surface,
  /** Written by the assistant after the first turn. */
  title: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
}) {}

/**
 * A conversation with every message, oldest first.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class ConversationThread
  extends Schema.Class<ConversationThread>("@bluechip/domain/assistant/Conversation/ConversationThread")({
    conversation: Conversation,
    messages: Schema.Array(Message)
  })
{}
