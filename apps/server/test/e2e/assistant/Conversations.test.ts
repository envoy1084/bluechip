import { NotFound } from "@bluechip/domain/Errors"
import { ConversationId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layer, TestUsers.layer), { excludeTestServices: true })(
  "assistant conversations",
  (it) => {
    describe("DELETE /api/assistant/conversations/:id", () => {
      it.effect("the owner's conversation is gone from the list, and reading it is 404", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({ to: "Delete me after", rounds: [[{ text: "Sure." }]] })
          const kept = yield* assistant.start(user)
          const deleted = yield* assistant.start(user)
          yield* assistant.ask(user, deleted.id, "Delete me after")

          yield* user.api.assistant.deleteConversation({ params: { id: deleted.id } })
          const page = yield* user.api.assistant.conversations({ query: {} })
          const error = yield* user.api.assistant.conversation({ params: { id: deleted.id } }).pipe(Effect.flip)

          assert.deepStrictEqual(
            [page.items.map((conversation) => conversation.id), { ...error }],
            [[kept.id], { ...new NotFound({ resource: "conversation", id: deleted.id }) }]
          )
        }))

      it.effect("what the assistant remembered from it stays, without its message", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Remember that I never want Ford",
            rounds: [
              [{ call: "remember", params: { kind: "constraint", text: "You never want Ford.", agentId: null } }],
              [{ text: "Noted." }]
            ]
          })
          const conversation = yield* assistant.start(user)
          yield* assistant.ask(user, conversation.id, "Remember that I never want Ford")

          yield* user.api.assistant.deleteConversation({ params: { id: conversation.id } })
          const memories = yield* user.api.assistant.memories({ query: {} })

          assert.deepStrictEqual(memories.map((memory) => [memory.text, memory.messageId]), [[
            "You never want Ford.",
            null
          ]])
        }))

      it.effect("a run going in it is stopped first, and its stream ends cancelled", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Tell me a long story",
            rounds: [[{ text: "Once upon a time", partial: true }, { hang: true }]]
          })
          const conversation = yield* assistant.start(user)
          const runId = randomUUID()
          const answering = yield* Deferred.make<void>()
          const response = yield* user.api.assistant.run({
            payload: {
              threadId: conversation.id,
              runId,
              messages: [{ id: randomUUID(), role: "user", content: "Tell me a long story" }],
              tools: [],
              context: []
            }
          })
          const reading = yield* response.body.pipe(
            Stream.tap((event: AgUiSchema.Event) =>
              event.type === "TEXT_MESSAGE_CONTENT" ? Deferred.succeed(answering, undefined) : Effect.void
            ),
            Stream.runCollect,
            Effect.forkChild
          )
          yield* Deferred.await(answering)

          yield* user.api.assistant.deleteConversation({ params: { id: conversation.id } })
          const events = Array.from(yield* Fiber.join(reading))
          const error = yield* user.api.assistant.conversation({ params: { id: conversation.id } }).pipe(Effect.flip)

          assert.deepStrictEqual(
            [events.at(-1), error._tag],
            [{ type: "RUN_FINISHED", threadId: conversation.id, runId, outcome: { type: "cancelled" } }, "NotFound"]
          )
        }))

      it.effect("404: another user's conversation, which stays", () =>
        Effect.gen(function*() {
          const users = yield* TestUsers
          const owner = yield* users.signUp
          const stranger = yield* users.signUp
          const conversation = yield* (yield* TestAssistant).start(owner)

          const error = yield* stranger.api.assistant.deleteConversation({ params: { id: conversation.id } }).pipe(
            Effect.flip
          )
          const page = yield* owner.api.assistant.conversations({ query: {} })

          assert.deepStrictEqual(
            [{ ...error }, page.items.map((each) => each.id)],
            [{ ...new NotFound({ resource: "conversation", id: conversation.id }) }, [conversation.id]]
          )
        }))

      it.effect("404: a conversation that doesn't exist", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const id = ConversationId.make(typeid("conversation").toString())

          const error = yield* user.api.assistant.deleteConversation({ params: { id } }).pipe(Effect.flip)

          assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "conversation", id }) })
        }))
    })
  }
)
