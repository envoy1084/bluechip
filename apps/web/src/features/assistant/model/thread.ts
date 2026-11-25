// A conversation as the screen shows it: your messages, and bluechip's turns (every model round between two of yours,
// merged) with their tool rows, text and cards. Built from the stored thread, then from a run's AG-UI events.
import type { Card } from "@bluechip/domain/assistant/Card"
import type { Message } from "@bluechip/domain/assistant/Conversation"
import { CARD_EVENT, CardEvent } from "@bluechip/domain/assistant/RunEvents"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import { toolSummary } from "./toolSummary.ts"

export interface ToolRow {
  readonly id: string
  readonly name: string
  readonly state: "running" | "done" | "failed"
  /** What the tool answered, in a few words, once it's done. */
  readonly summary: string | null
}

export interface ShownCard {
  /** The tool call that made it; `null` for the assistant's own cards. */
  readonly toolCallId: string | null
  readonly card: Card
}

export interface YourMessage {
  readonly _tag: "You"
  readonly id: string
  readonly text: string
}

export interface BluechipTurn {
  readonly _tag: "Bluechip"
  readonly id: string
  readonly tools: ReadonlyArray<ToolRow>
  readonly text: string
  readonly cards: ReadonlyArray<ShownCard>
  readonly status: "streaming" | "done" | "error"
  /** Why the turn ended without an answer. */
  readonly error: string | null
}

export type Entry = YourMessage | BluechipTurn

export const emptyTurn = (id: string): BluechipTurn => ({
  _tag: "Bluechip",
  id,
  tools: [],
  text: "",
  cards: [],
  status: "streaming",
  error: null
})

const isFailure = (event: AgUiSchema.ToolCallResultEvent): boolean => {
  const marker = event.metadata?.["effect/ai"]
  return Predicate.hasProperty(marker, "isFailure") && marker.isFailure === true
}

// The result of a call as it arrived: the tool's encoded result as a JSON string.
const resultOf = (content: AgUiSchema.ToolCallResultEvent["content"]): unknown =>
  typeof content === "string"
    ? Option.getOrNull(Schema.decodeOption(Schema.fromJsonString(Schema.Unknown))(content))
    : null

const finishTool = (turn: BluechipTurn, event: AgUiSchema.ToolCallResultEvent): BluechipTurn => ({
  ...turn,
  tools: turn.tools.map((row) => {
    if (row.id !== event.toolCallId) return row
    return isFailure(event) ?
      { ...row, state: "failed" } :
      { ...row, state: "done", summary: toolSummary(row.name, resultOf(event.content)) }
  })
})

const addCard = (turn: BluechipTurn, shown: ShownCard): BluechipTurn => ({
  ...turn,
  cards: turn.cards.some(({ card }) => card.id === shown.card.id) ?
    turn.cards.map((existing) => existing.card.id === shown.card.id ? shown : existing) :
    [...turn.cards, shown]
})

/** The thread as stored, oldest first: an assistant message joins the turn before it. */
export const entriesOf = (messages: ReadonlyArray<Message>): Array<Entry> => {
  const entries: Array<Entry> = []
  for (const message of messages) {
    if (message.role === "user") {
      const text = message.parts.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")
      entries.push({ _tag: "You", id: message.id, text })
      continue
    }

    const last = entries.at(-1)
    const turn = last?._tag === "Bluechip" ? last : { ...emptyTurn(message.id), status: "done" as const }
    // Rounds answer in separate text parts; they read as paragraphs of one answer.
    const texts = turn.text === "" ? [] : [turn.text]
    const tools = new Map(turn.tools.map((row) => [row.id, row]))
    const cards = new Map(turn.cards.map((shown) => [shown.card.id, shown]))
    let error = turn.error
    for (const part of message.parts) {
      if (part.type === "text") texts.push(part.text)
      else if (part.type === "toolCall") {
        tools.set(part.id, { id: part.id, name: part.name, state: "running", summary: null })
      } else if (part.type === "toolResult") {
        const row = tools.get(part.id)
        if (row === undefined) continue
        tools.set(
          part.id,
          part.isFailure ?
            { ...row, state: "failed" } :
            { ...row, state: "done", summary: toolSummary(part.name, part.result) }
        )
      } else if (part.type === "card") cards.set(part.card.id, { toolCallId: part.toolCallId, card: part.card })
      else if (part.type === "error") error = part.message
    }

    const merged: BluechipTurn = {
      ...turn,
      text: texts.join("\n\n"),
      // A call whose result was never stored (a cancelled round) didn't finish.
      tools: Array.from(tools.values(), (row) => row.state === "running" ? { ...row, state: "failed" } : row),
      cards: Array.from(cards.values()),
      status: error === null ? "done" : "error",
      error
    }
    if (last?._tag === "Bluechip") entries[entries.length - 1] = merged
    else entries.push(merged)
  }
  return entries
}

/** A turn after one more event of its run. */
export const applyEvent = (turn: BluechipTurn, event: AgUiSchema.Event): BluechipTurn => {
  switch (event.type) {
    case "TEXT_MESSAGE_START":
      return turn.text === "" ? turn : { ...turn, text: `${turn.text}\n\n` }
    case "TEXT_MESSAGE_CONTENT":
      return { ...turn, text: turn.text + event.delta }
    case "TOOL_CALL_START":
      return {
        ...turn,
        tools: [...turn.tools, { id: event.toolCallId, name: event.toolCallName, state: "running", summary: null }]
      }
    case "TOOL_CALL_RESULT":
      return finishTool(turn, event)
    case "CUSTOM": {
      if (event.name !== CARD_EVENT) return turn
      // Cards arrive JSON-encoded (amounts as strings, times as ISO dates).
      return Option.match(Schema.decodeUnknownOption(Schema.toCodecJson(CardEvent))(event), {
        onNone: () => turn,
        onSome: ({ value }) => addCard(turn, value)
      })
    }
    case "RUN_FINISHED":
      return {
        ...turn,
        text: turn.text.trimEnd(),
        status: "done",
        tools: turn.tools.map((row) => row.state === "running" ? { ...row, state: "done" } : row)
      }
    case "RUN_ERROR":
      return {
        ...turn,
        text: turn.text.trimEnd(),
        status: "error",
        error: event.message,
        tools: turn.tools.map((row) => row.state === "running" ? { ...row, state: "failed" } : row)
      }
    default:
      return turn
  }
}

/** Every entry with `card` in place of the card it replaces (after you confirm or dismiss it). */
export const replaceCard = (entries: ReadonlyArray<Entry>, card: Card): Array<Entry> =>
  entries.map((entry) =>
    entry._tag === "Bluechip" && entry.cards.some((shown) => shown.card.id === card.id) ?
      { ...entry, cards: entry.cards.map((shown) => shown.card.id === card.id ? { ...shown, card } : shown) } :
      entry
  )

/**
 * The thread after a dropped connection, once read again: the stored one when it has caught up (it answers your last
 * message, the round kept as far as it got), otherwise the one on screen, while the server is still storing it.
 */
export const resumeEntries = (shown: ReadonlyArray<Entry>, stored: ReadonlyArray<Entry>): ReadonlyArray<Entry> => {
  const yours = (entries: ReadonlyArray<Entry>) => entries.filter((entry) => entry._tag === "You").length
  return stored.at(-1)?._tag === "Bluechip" && yours(stored) >= yours(shown) ? stored : shown
}
