// Conversations with the assistant as the web app has them: runs over the typed client, read to their last event.
import type { Card } from "@bluechip/domain/assistant/Card"
import type { Conversation } from "@bluechip/domain/assistant/Conversation"
import { CARD_EVENT, CardEvent } from "@bluechip/domain/assistant/RunEvents"
import type { AgentId, ConversationId } from "@bluechip/domain/Ids"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { randomUUID } from "node:crypto"
import type { Browser } from "./TestUsers.ts"
import { TestUsers } from "./TestUsers.ts"

/** A run as the client saw it: every event, and the cards among them. */
export interface RunEvents {
  readonly runId: string
  readonly events: ReadonlyArray<AgUiSchema.Event>
  readonly cards: ReadonlyArray<Card>
}

export class TestAssistant extends Context.Service<TestAssistant, {
  /** `POST /api/assistant/conversations`. */
  readonly start: (user: Browser, agentId?: AgentId) => Effect.Effect<Conversation>
  /** `POST /api/assistant/run` with `text` as the new message (and `resume` answers), read to the end. */
  readonly ask: (user: Browser, conversationId: ConversationId, text: string, options?: {
    readonly resume?: ReadonlyArray<AgUiSchema.ResumeEntry>
  }) => Effect.Effect<RunEvents>
  /** The cards in a list of events. */
  readonly cardsOf: (events: ReadonlyArray<AgUiSchema.Event>) => ReadonlyArray<Card>
}>()("@bluechip/server/test/TestAssistant") {
  static readonly layerNoDeps = Layer.sync(TestAssistant, () => {
    const cardsOf = (events: ReadonlyArray<AgUiSchema.Event>): ReadonlyArray<Card> =>
      events.flatMap((event) =>
        event.type === "CUSTOM" && event.name === CARD_EVENT ?
          [Schema.decodeUnknownSync(Schema.toCodecJson(CardEvent.fields.value))(event.value).card] :
          []
      )

    const ask = Effect.fnUntraced(function*(
      user: Browser,
      conversationId: ConversationId,
      text: string,
      options: { readonly resume?: ReadonlyArray<AgUiSchema.ResumeEntry> } = {}
    ) {
      const runId = randomUUID()
      const response = yield* user.api.assistant.run({
        payload: {
          threadId: conversationId,
          runId,
          messages: text.length === 0 ? [] : [{ id: randomUUID(), role: "user", content: text }],
          tools: [],
          context: [],
          ...(options.resume === undefined ? {} : { resume: options.resume })
        }
      })
      const events = Array.from(yield* Stream.runCollect(response.body))
      return { runId, events, cards: cardsOf(events) }
    }, Effect.orDie)

    return {
      start: (user, agentId) =>
        Effect.orDie(user.api.assistant.startConversation({ payload: { agentId: agentId ?? null } })),
      ask,
      cardsOf
    }
  })

  static readonly layer = this.layerNoDeps.pipe(Layer.provideMerge(TestUsers.layer))
}
