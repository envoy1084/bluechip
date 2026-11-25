import { NotFound } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as Stream from "effect/Stream"
import { randomUUID } from "node:crypto"
import { Assistant } from "../../../../src/modules/assistant/Assistant.ts"
import { RecordedModel } from "../../../utils/RecordedModel.ts"
import { TestAssistant } from "../../../utils/TestAssistant.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server's services run on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("Assistant", (it) => {
  describe("cancel", () => {
    it.effect("a run cancelled before its model answers ends cancelled, with a card saying so", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const me = yield* user.api.account.me()
        const owner = { id: me.user.id, account: user.account }
        const assistant = yield* Assistant
        yield* (yield* RecordedModel).record({ to: "Write me a long essay", rounds: [[{ text: "Once upon a time…" }]] })
        const conversation = yield* (yield* TestAssistant).start(user)
        const runId = randomUUID()
        const events = yield* assistant.run(owner, {
          threadId: conversation.id,
          runId,
          messages: [{ id: randomUUID(), role: "user", content: "Write me a long essay" }],
          tools: [],
          context: []
        })

        yield* assistant.cancel(owner, runId)
        const collected = Array.from(yield* Stream.runCollect(events))
        const last = collected.at(-1)

        assert.deepStrictEqual(
          [
            (yield* TestAssistant).cardsOf(collected).map((card) => card._tag === "Error" ? card.reason : card._tag),
            last?.type === "RUN_FINISHED" ? last.outcome : undefined
          ],
          [["cancelled"], { type: "cancelled" }]
        )
      }))

    it.effect("a run that ended can't be cancelled", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const me = yield* user.api.account.me()
        const owner = { id: me.user.id, account: user.account }
        const assistant = yield* Assistant
        yield* (yield* RecordedModel).record({ to: "Quick one", rounds: [[{ text: "Done." }]] })
        const conversation = yield* (yield* TestAssistant).start(user)
        const runId = randomUUID()
        const events = yield* assistant.run(owner, {
          threadId: conversation.id,
          runId,
          messages: [{ id: randomUUID(), role: "user", content: "Quick one" }],
          tools: [],
          context: []
        })
        yield* Stream.runDrain(events)

        const error = yield* assistant.cancel(owner, runId).pipe(Effect.flip)

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "run", id: runId }) })
      }))
  })

  describe("run", () => {
    it.effect("a second run in a conversation with a run going is refused", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const me = yield* user.api.account.me()
        const owner = { id: me.user.id, account: user.account }
        const assistant = yield* Assistant
        yield* (yield* RecordedModel).record({ to: "First", rounds: [[{ text: "Hi." }]] })
        const conversation = yield* (yield* TestAssistant).start(user)
        const input = (text: string) => ({
          threadId: conversation.id,
          runId: randomUUID(),
          messages: [{ id: randomUUID(), role: "user" as const, content: text }],
          tools: [],
          context: []
        })
        // Started, not read: the run stays going.
        const going = yield* assistant.run(owner, input("First"))

        const error = yield* assistant.run(owner, input("Second")).pipe(Effect.flip)

        assert.instanceOf(error, HttpApiError.BadRequest)
        yield* Stream.runDrain(going)
      }))
  })
})
