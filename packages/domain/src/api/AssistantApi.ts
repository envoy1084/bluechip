/**
 * @since 0.0.0
 */
import * as AgUiServer from "effect/ai/AgUiServer"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Budget } from "../assistant/Budget.ts"
import { Card } from "../assistant/Card.ts"
import { Conversation, ConversationThread } from "../assistant/Conversation.ts"
import { Memory, MemoryExport } from "../assistant/Memory.ts"
import { Authentication } from "../Auth.ts"
import { Conflict, InvalidAutomation, InvalidSpec, NotFound } from "../Errors.ts"
import { AgentId, CardId, ConversationId, MemoryId, RunId } from "../Ids.ts"
import { Page, PageQuery } from "../Page.ts"

/**
 * The assistant: conversations, their runs over AG-UI, the cards they show and what it remembers.
 *
 * A run is `POST /assistant/run` with an AG-UI `RunAgentInput`: `threadId` is the conversation's id, and the last
 * message (`role: "user"`) is what you said; earlier messages are ignored, because the conversation is read from
 * bluechip's records. `resume` entries (`interruptId` a card's id) confirm (`resolved`) or dismiss (`cancelled`) cards
 * before the turn. The run streams AG-UI events: text, tool calls and results, and each card as a `CUSTOM` event
 * (`CardEvent`). It ends with `RUN_FINISHED` (its outcome an `interrupt` listing the cards waiting for you) or
 * `RUN_ERROR`. A thread that isn't yours, a run already going in it, or no new message is `400`.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class AssistantApi extends HttpApiGroup.make("assistant").add(
  HttpApiEndpoint.get("conversations", "/assistant/conversations", {
    query: PageQuery,
    success: Page(Conversation)
  }),
  HttpApiEndpoint.post("startConversation", "/assistant/conversations", {
    /** `agentId`: the agent the conversation is about, if it starts from one. */
    payload: Schema.Struct({ agentId: Schema.NullOr(AgentId) }),
    success: Conversation,
    error: NotFound
  }),
  HttpApiEndpoint.get("conversation", "/assistant/conversations/:id", {
    params: { id: ConversationId },
    success: ConversationThread,
    error: NotFound
  }),
  AgUiServer.endpoint("run", "/assistant/run"),
  HttpApiEndpoint.post("cancel", "/assistant/runs/:id/cancel", {
    params: { id: RunId },
    success: Schema.Void,
    error: NotFound
  }),
  HttpApiEndpoint.post("confirmCard", "/assistant/cards/:id/confirm", {
    params: { id: CardId },
    /** The card, applied. An automation that no longer fits its agent's policies is `InvalidAutomation`. */
    success: Card,
    error: [NotFound, Conflict, InvalidSpec, InvalidAutomation]
  }),
  HttpApiEndpoint.post("dismissCard", "/assistant/cards/:id/dismiss", {
    params: { id: CardId },
    success: Card,
    error: [NotFound, Conflict]
  }),
  HttpApiEndpoint.get("memories", "/assistant/memories", {
    /** `q`: only the memories it recalls (by words and meaning), best first; every memory, newest first, without. */
    query: { q: Schema.optionalKey(Schema.String) },
    success: Schema.Array(Memory)
  }),
  HttpApiEndpoint.get("exportMemories", "/assistant/memories/export", {
    /** Every memory (with its uses) and conversation summary, to download as JSON. */
    success: MemoryExport
  }),
  HttpApiEndpoint.post("confirmMemory", "/assistant/memories/:id/confirm", {
    params: { id: MemoryId },
    /** The memory, confirmed: prompts use it from now on. Confirming it again returns it unchanged. */
    success: Memory,
    error: NotFound
  }),
  HttpApiEndpoint.delete("deleteMemory", "/assistant/memories/:id", {
    params: { id: MemoryId },
    success: Schema.Void,
    error: NotFound
  }),
  /** Forgets everything: every memory, conversation summary and what can be recalled from past conversations. */
  HttpApiEndpoint.delete("deleteMemories", "/assistant/memories", {
    success: Schema.Void
  }),
  HttpApiEndpoint.get("budget", "/assistant/budget", {
    success: Budget
  })
).middleware(Authentication) {}
