// Stored conversation messages and cards, as `GET /api/assistant/conversations/:id` returns them.
import type { Card } from "@bluechip/domain/assistant/Card"
import { Message, type MessagePart } from "@bluechip/domain/assistant/Conversation"
import { CardId, MessageId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"

export const CARD_ID = CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v3w")

/** The assistant's card saying the day's budget ran out, with `message`. */
export const budgetCard = (message: string): Card => ({ _tag: "Error", id: CARD_ID, reason: "budget", message })

/** A message with id `message_…<suffix>`. */
export const message = (
  suffix: string,
  role: "user" | "assistant",
  parts: ReadonlyArray<MessagePart>
): Message =>
  new Message({
    id: MessageId.make(`message_01jd8v4t5m6n7a8q9r0s1t2v${suffix}`),
    role,
    parts,
    model: role === "user" ? null : "claude-sonnet-5-5",
    createdAt: DateTime.makeUnsafe("2026-11-26T10:00:00Z")
  })
