import { NotFound } from "@bluechip/domain/Errors"
import { ConversationId, RunId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as Layer from "effect/Layer"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { CONVERSATION_MODEL, RecordedModel, SMALL_MODEL } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layer, TestUsers.layer), { excludeTestServices: true })("assistant runs", (it) => {
  describe("POST /api/assistant/run", () => {
    it.effect("a question answered with a read tool streams the run's events, from RUN_STARTED to RUN_FINISHED", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "How much do I have?",
          rounds: [[{ call: "getPortfolio", params: {} }], [{ text: "You have no money in bluechip yet." }]]
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, "How much do I have?")

        assert.deepStrictEqual(run.events.map((event) => event.type), [
          "RUN_STARTED",
          "STEP_STARTED",
          "TOOL_CALL_START",
          "TOOL_CALL_ARGS",
          "TOOL_CALL_END",
          "TOOL_CALL_RESULT",
          "STEP_FINISHED",
          "STEP_STARTED",
          "TEXT_MESSAGE_START",
          "TEXT_MESSAGE_CONTENT",
          "TEXT_MESSAGE_END",
          "STEP_FINISHED",
          "RUN_FINISHED"
        ])
      }))

    it.effect("the conversation keeps the turn: your message, the tool round and the answer, by model", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "What's in my portfolio?",
          rounds: [[{ call: "getPortfolio", params: {} }], [{ text: "Nothing yet." }]]
        })
        const conversation = yield* assistant.start(user)

        yield* assistant.ask(user, conversation.id, "What's in my portfolio?")
        const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })

        assert.deepStrictEqual(
          thread.messages.map((message) => [message.role, message.model, message.parts.map((part) => part.type)]),
          [
            ["user", null, ["text"]],
            ["assistant", CONVERSATION_MODEL, ["toolCall", "toolResult"]],
            ["assistant", CONVERSATION_MODEL, ["text"]]
          ]
        )
      }))

    it.effect("the next turn sends the model the stored conversation, not the client's", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* recorded.record(
          { to: "Hi there", rounds: [[{ text: "Hello!" }]] },
          { to: "And again", rounds: [[{ text: "Hello again!" }]] }
        )
        const conversation = yield* assistant.start(user)
        yield* assistant.ask(user, conversation.id, "Hi there")

        yield* assistant.ask(user, conversation.id, "And again")
        const [prompt] = yield* recorded.prompts("And again")

        assert.deepStrictEqual(prompt!.content.map((message) => message.role), [
          "system",
          "user",
          "assistant",
          "user"
        ])
      }))

    it.effect("when the conversation model fails, the small model answers", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "Are you there?",
          conversationFails: true,
          rounds: [[{ text: "Yes." }]]
        })
        const conversation = yield* assistant.start(user)

        yield* assistant.ask(user, conversation.id, "Are you there?")
        const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })

        assert.deepStrictEqual(thread.messages.map((message) => message.model), [null, SMALL_MODEL])
      }))

    it.effect("a turn needing more than 8 model rounds stops with an error card", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "Check again and again",
          rounds: Array.from({ length: 9 }, () => [{ call: "getPortfolio", params: {} }])
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, "Check again and again")

        assert.deepStrictEqual(run.cards.map((card) => card._tag === "Error" ? card.reason : card._tag), ["rounds"])
      }))

    it.effect("a new conversation is named after its first turn", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "Tell me about Nvidia",
          rounds: [[{ text: "Nvidia makes chips." }]],
          notes: { title: "About Nvidia", memories: [] }
        })
        const conversation = yield* assistant.start(user)

        yield* assistant.ask(user, conversation.id, "Tell me about Nvidia")
        const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })

        assert.strictEqual(thread.conversation.title, "About Nvidia")
      }))

    it.effect("400: a conversation of another user", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const owner = yield* users.signUp
        const stranger = yield* users.signUp
        const conversation = yield* (yield* TestAssistant).start(owner)

        const error = yield* stranger.api.assistant.run({
          payload: {
            threadId: conversation.id,
            runId: randomUUID(),
            messages: [{ id: randomUUID(), role: "user", content: "What does this user hold?" }],
            tools: [],
            context: []
          }
        }).pipe(Effect.flip)

        assert.instanceOf(error, HttpApiError.BadRequest)
      }))

    it.effect("400: a run with no new message", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const conversation = yield* (yield* TestAssistant).start(user)

        const error = yield* user.api.assistant.run({
          payload: { threadId: conversation.id, runId: randomUUID(), messages: [], tools: [], context: [] }
        }).pipe(Effect.flip)

        assert.instanceOf(error, HttpApiError.BadRequest)
      }))
  })

  describe("POST /api/assistant/runs/:id/cancel", () => {
    it.effect("404: a run that isn't going", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const id = RunId.make(randomUUID())

        const error = yield* user.api.assistant.cancel({ params: { id } }).pipe(Effect.flip)

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "run", id }) })
      }))
  })

  describe("GET /api/assistant/conversations", () => {
    it.effect("lists the user's conversations, newest first", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const first = yield* assistant.start(user)
        const second = yield* assistant.start(user)

        const page = yield* user.api.assistant.conversations({ query: {} })

        assert.deepStrictEqual(page.items.map((conversation) => conversation.id), [second.id, first.id])
      }))
  })

  describe("GET /api/assistant/conversations/:id", () => {
    it.effect("404: another user's conversation", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const conversation = yield* (yield* TestAssistant).start(yield* users.signUp)
        const stranger = yield* users.signUp

        const error = yield* stranger.api.assistant.conversation({ params: { id: conversation.id } }).pipe(Effect.flip)

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "conversation", id: conversation.id }) })
      }))

    it.effect("404: a conversation that doesn't exist", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const id = ConversationId.make(typeid("conversation").toString())

        const error = yield* user.api.assistant.conversation({ params: { id } }).pipe(Effect.flip)

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "conversation", id }) })
      }))
  })
})
