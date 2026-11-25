/**
 * bluechip's AG-UI custom events: what a run streams besides AG-UI's own text and tool events.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Card } from "./Card.ts"

/**
 * The custom event name of a card.
 *
 * @stability unstable
 * @category events
 * @since 0.0.0
 */
export const CARD_EVENT = "bluechip.card"

/**
 * A card, sent as an AG-UI `CUSTOM` event right after the `TOOL_CALL_RESULT` it came from (`toolCallId`), or on its
 * own for the assistant's own cards (memories to confirm, research, errors; `toolCallId` is `null`). Decode an event
 * whose `name` is {@link CARD_EVENT} with this schema's `value`.
 *
 * @stability unstable
 * @category events
 * @since 0.0.0
 */
export const CardEvent = Schema.Struct({
  type: Schema.Literal("CUSTOM"),
  name: Schema.Literal(CARD_EVENT),
  value: Schema.Struct({ toolCallId: Schema.NullOr(Schema.String), card: Card })
})

/**
 * @stability unstable
 * @category events
 * @since 0.0.0
 */
export type CardEvent = typeof CardEvent.Type
