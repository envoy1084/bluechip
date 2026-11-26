// What the assistant says and does in one model round, as beats: text, tool calls with their results (and the cards
// they made), and its own cards. The scenario's threads store them as messages; a run streams them, then stores them
// the same way, so a stored thread and a live answer look alike.
import { Card } from "@bluechip/domain/assistant/Card"
import { Message, type Message as MessageType, type MessagePart } from "@bluechip/domain/assistant/Conversation"
import type { Memory } from "@bluechip/domain/assistant/Memory"
import type { MessageId } from "@bluechip/domain/Ids"
import { RESEARCH_TOOL } from "@bluechip/domain/tools/Toolkit"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import type { CastConversation } from "../cast.ts"
import type { Mint } from "./mint.ts"

export type Beat =
  | { readonly _tag: "Text"; readonly text: string }
  | {
    readonly _tag: "Tool"
    readonly id: string
    readonly name: string
    readonly params: unknown
    /** JSON, as the tool's success schema encodes it. */
    readonly result: unknown
    readonly cards: ReadonlyArray<Card>
    /** Tools Anthropic runs (web search). */
    readonly providerExecuted: boolean
    /** The tool answered with a problem instead of a result. */
    readonly failed?: boolean
  }
  /** A card the assistant makes itself (research, memories, errors). */
  | { readonly _tag: "Card"; readonly card: Card }
  /** The model failed: the turn ends without an answer. */
  | { readonly _tag: "Failed"; readonly message: string }

export type Round = ReadonlyArray<Beat>

/** What a scripted thread is written from: its conversation in the cast, and the scenario's memories. */
export interface ThreadContext {
  readonly mint: Mint
  readonly conversation: CastConversation
  readonly memories: ReadonlyArray<Memory>
  /** Keeps memories a thread's cards are about, so the memory page lists them. */
  readonly keep: (memories: ReadonlyArray<Memory>) => void
}

/** One turn of a scripted thread: what you said, then the rounds that answered it. */
export interface Turn {
  readonly you: string
  readonly rounds: ReadonlyArray<Round>
}

export const MODEL = "claude-sonnet-5-5"

export const say = (text: string): Beat => ({ _tag: "Text", text })

export const own = (card: Card): Beat => ({ _tag: "Card", card })

export const failed = (message: string): Beat => ({ _tag: "Failed", message })

/** A tool's result as it is stored and streamed: JSON from its success schema. */
export const encodeResult = <A>(schema: Schema.Codec<A, unknown>, value: A): unknown =>
  Schema.encodeUnknownSync(Schema.toCodecJson(schema))(value)

/** A tool call that read something. */
export const read = <A>(
  mint: Mint,
  name: string,
  params: unknown,
  schema: Schema.Codec<A, unknown>,
  value: A
): Beat => ({
  _tag: "Tool",
  id: mint.id("toolu"),
  name,
  params,
  result: encodeResult(schema, value),
  cards: [],
  providerExecuted: false
})

/** A tool call that answered with a problem (`ToolProblem`), as its row shows: "Didn't finish …". */
export const fails = (mint: Mint, name: string, params: unknown, message: string): Beat => ({
  _tag: "Tool",
  id: mint.id("toolu"),
  name,
  params,
  result: { _tag: "ToolProblem", problem: message },
  cards: [],
  providerExecuted: false,
  failed: true
})

/** A tool call whose answer is a card (or several). */
export const shows = (mint: Mint, name: string, params: unknown, cards: Card | ReadonlyArray<Card>): Beat => {
  const list: ReadonlyArray<Card> = Array.isArray(cards) ? cards : [cards as Card]
  return {
    _tag: "Tool",
    id: mint.id("toolu"),
    name,
    params,
    result: Array.isArray(cards) ? encodeResult(Schema.Array(Card), list) : encodeResult(Card, list[0]!),
    cards: list,
    providerExecuted: false
  }
}

/** A web search Anthropic ran: the pages it read, as its results. */
export const searched = (
  mint: Mint,
  query: string,
  pages: ReadonlyArray<{ readonly url: string; readonly title: string }>
): Beat => ({
  _tag: "Tool",
  id: mint.id("srvtoolu"),
  name: RESEARCH_TOOL,
  params: { query },
  result: pages.map((page) => ({ type: "web_search_result", url: page.url, title: page.title, page_age: null })),
  cards: [],
  providerExecuted: true
})

/** A round's parts in the order bluechip stores them: what the model wrote and called, then the cards. */
export const partsOf = (round: Round): Array<MessagePart> => {
  const parts: Array<MessagePart> = []
  for (const beat of round) {
    if (beat._tag === "Text") parts.push({ type: "text", text: beat.text })
    if (beat._tag !== "Tool") continue
    parts.push(
      { type: "toolCall", id: beat.id, name: beat.name, params: beat.params, providerExecuted: beat.providerExecuted },
      {
        type: "toolResult",
        id: beat.id,
        name: beat.name,
        result: beat.result,
        isFailure: beat.failed === true,
        providerExecuted: beat.providerExecuted,
        modelOutput: null
      }
    )
  }
  for (const beat of round) {
    if (beat._tag === "Tool") {
      for (const card of beat.cards) parts.push({ type: "card", toolCallId: beat.id, card })
    }
    if (beat._tag === "Card") parts.push({ type: "card", toolCallId: null, card: beat.card })
  }
  for (const beat of round) {
    if (beat._tag === "Failed") parts.push({ type: "error", message: beat.message })
  }
  return parts
}

export const message = (
  mint: Mint,
  role: MessageType["role"],
  parts: ReadonlyArray<MessagePart>,
  at: DateTime.Utc
): MessageType =>
  new Message({
    id: mint.id("message") as MessageId,
    role,
    parts,
    model: role === "user" ? null : MODEL,
    createdAt: at
  })

/**
 * A scripted thread as stored messages, its last message `hoursAgo`: turns a few minutes apart, each round a few
 * seconds after the one before.
 */
export const messagesOf = (mint: Mint, hoursAgo: number, turns: ReadonlyArray<Turn>): Array<MessageType> => {
  const messages: Array<MessageType> = []
  turns.forEach((turn, index) => {
    const start = DateTime.subtract(mint.at(hoursAgo), { minutes: (turns.length - 1 - index) * 4, seconds: 30 })
    messages.push(message(mint, "user", [{ type: "text", text: turn.you }], start))
    turn.rounds.forEach((round, step) => {
      messages.push(message(mint, "assistant", partsOf(round), DateTime.add(start, { seconds: 6 * (step + 1) })))
    })
  })
  return messages
}
