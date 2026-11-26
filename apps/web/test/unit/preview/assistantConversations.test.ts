import type { ConversationId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { previewApi } from "../../utils/PreviewApi.ts"

describe("preview DELETE /api/assistant/conversations/:id", () => {
  it.effect("the conversation leaves the list and its thread is 404, with its summary gone", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")
      const before = yield* client.assistant.conversations({ query: { pageSize: 100 } })
      const deleted = before.items[0]!

      yield* client.assistant.deleteConversation({ params: { id: deleted.id } })
      const after = yield* client.assistant.conversations({ query: { pageSize: 100 } })
      const error = yield* Effect.flip(client.assistant.conversation({ params: { id: deleted.id } }))
      const exported = yield* client.assistant.exportMemories()

      assert.deepStrictEqual(
        [
          after.items.map((conversation) => conversation.id),
          error._tag,
          exported.summaries.some((summary) => summary.conversationId === deleted.id)
        ],
        [before.items.slice(1).map((conversation) => conversation.id), "NotFound", false]
      )
    }))

  it.effect("404 for a conversation that isn't there", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const error = yield* Effect.flip(
        client.assistant.deleteConversation({
          params: { id: "conversation_01kqpv0000700890000000zzzz" as ConversationId }
        })
      )

      assert.strictEqual(error._tag, "NotFound")
    }))
})
