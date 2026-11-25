import type { ConversationId } from "@bluechip/domain/Ids"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type { Owner } from "../signing/SigningRequests.ts"
import { AssistantModels } from "./AssistantModels.ts"
import { Budgets } from "./Budgets.ts"
import { Conversations } from "./Conversations.ts"
import { tokenUsage } from "./Transcript.ts"

const Title = Schema.Struct({
  title: Schema.String.annotate({ description: "A title of at most 6 words, in sentence case, no quotes." })
})

/** Names a new conversation after its first message, on the small model (its cost counted in the user's budget). */
export class Titles extends Context.Service<Titles, {
  readonly name: (owner: Owner, conversationId: ConversationId, userText: string) => Effect.Effect<void>
}>()("@bluechip/server/Titles") {
  static readonly layer = Layer.effect(
    Titles,
    Effect.gen(function*() {
      const models = yield* AssistantModels
      const budgets = yield* Budgets
      const conversations = yield* Conversations

      const name = Effect.fn("Titles.name")(function*(owner: Owner, conversationId: ConversationId, userText: string) {
        const response = yield* models.small(LanguageModel.generateObject({
          objectName: "conversation_title",
          schema: Title,
          prompt: [
            {
              role: "system",
              content: "Name a conversation with a stock-trading app's assistant from its first message."
            },
            { role: "user", content: `<user_message>\n${userText}\n</user_message>` }
          ]
        }))
        yield* budgets.record(owner, models.smallModel, tokenUsage(response.usage))
        yield* conversations.setTitle(conversationId, response.value.title.trim().slice(0, 80))
      }, (effect) =>
        // A conversation left untitled is named on its next turn.
        effect.pipe(Effect.catchTag("AiError", (error) => Effect.logWarning("Naming a conversation failed", error))))

      return Titles.of({ name })
    })
  )
}
