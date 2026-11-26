// A run of the preview's assistant over AG-UI, as bluechip's `Assistant` streams one: your message stored, then the
// reply's rounds typed out word by word, its tool calls (start, arguments, end, result) and cards, each round stored
// as it ends, and `RUN_FINISHED` listing the cards waiting for you. The panel sets the pace and what goes wrong: the
// day's budget spent, a slow tool, the model failing, too many steps, or a guess to confirm at the end. Stop ends it
// cancelled, and a reader that goes away leaves it interrupted, both kept as far as they got.
import { isSpent } from "@bluechip/domain/assistant/Budget"
import { type Card, describeCard, isPending } from "@bluechip/domain/assistant/Card"
import { Conversation, MAX_MESSAGE_LENGTH } from "@bluechip/domain/assistant/Conversation"
import { CARD_EVENT, CardEvent } from "@bluechip/domain/assistant/RunEvents"
import type { Conflict, InvalidAutomation, InvalidSpec, NotFound } from "@bluechip/domain/Errors"
import type { CardId } from "@bluechip/domain/Ids"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import * as Arr from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as Queue from "effect/Queue"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import type { PreviewStore } from "../../store.ts"
import { appendMessage, type ReplyPace, type Run, threadById } from "../../world/assistant.ts"
import { STOPPED } from "../../world/assistant/cards.ts"
import { GUESSES, memoryOf } from "../../world/assistant/memories.ts"
import { makeMint, type Mint } from "../../world/assistant/mint.ts"
import { type Beat, failed, message, own, partsOf, type Round, say } from "../../world/assistant/rounds.ts"
import type { cardAnswers } from "./cards.ts"
import { replyTo } from "./replies.ts"

class Stopped extends Data.TaggedError("Stopped")<{}> {}

/** Milliseconds between two words, and for a tool to answer. */
const PACE: Readonly<Record<ReplyPace, { readonly word: number; readonly tool: number }>> = {
  instant: { word: 0, tool: 0 },
  normal: { word: 24, tool: 700 },
  slow: { word: 160, tool: 1_800 }
}

const LONG_TOOL_MS = 7_000

const encodeCardEvent = Schema.encodeSync(Schema.toCodecJson(CardEvent.fields.value))

const cardEvent = (toolCallId: string | null, card: Card): AgUiSchema.Event => ({
  type: "CUSTOM",
  name: CARD_EVENT,
  value: encodeCardEvent({ toolCallId, card })
})

/** A text in the pieces a model streams: a word or two each, spaces and line breaks kept. */
const pieces = (text: string): Array<string> => {
  const words = text.match(/\s*\S+\s*/g) ?? [text]
  return Arr.chunksOf(words, 2).map((pair) => pair.join(""))
}

const titleOf = (text: string): string => {
  const words = text.replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ")
  return words.charAt(0).toUpperCase() + words.slice(1).replace(/[.?!,]+$/, "")
}

type Answers = ReturnType<typeof cardAnswers>

/**
 * Starts a run: the thread must be one of the conversations, with no run going, and the input must say something or
 * answer cards (`resume`). `BadRequest` before anything is stored otherwise.
 */
export const startRun = (preview: PreviewStore, answers: Answers) =>
  Effect.fnUntraced(function*(input: AgUiSchema.RunAgentInput) {
    const slice = preview.world.assistant
    const thread = threadById(slice, input.threadId)
    if (thread === undefined) return yield* new HttpApiError.BadRequest({})
    const busy = [...slice.runs.values()].some((run) => run.conversationId === thread.conversation.id)
    if (busy || slice.runs.has(input.runId)) return yield* new HttpApiError.BadRequest({})

    const last = input.messages.at(-1)
    const text = last?.role !== "user" ?
      "" :
      (typeof last.content === "string" ?
        last.content :
        last.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")).trim()
    if (text.length > MAX_MESSAGE_LENGTH) return yield* new HttpApiError.BadRequest({})
    if (text.length === 0 && (input.resume ?? []).length === 0) return yield* new HttpApiError.BadRequest({})

    for (const entry of input.resume ?? []) {
      const answer: Effect.Effect<Card, NotFound | Conflict | InvalidSpec | InvalidAutomation> =
        entry.status === "resolved" ? answers.confirm(entry.interruptId) : answers.dismiss(entry.interruptId)
      yield* answer.pipe(
        // Answered already (another tab, or the confirm endpoint): nothing left to do.
        Effect.catchTag("Conflict", () => Effect.void),
        Effect.mapError(() => new HttpApiError.BadRequest({}))
      )
    }
    if (text.length === 0) return Stream.empty

    const mint = makeMint(preview.cast, new Date(), slice.counters, "run")
    preview.update(() => appendMessage(slice, thread, message(mint, "user", [{ type: "text", text }], mint.at(0))))
    const run: Run = { conversationId: thread.conversation.id, cancelled: false }
    slice.runs.set(input.runId, run)

    return turn(preview, { input, text, run, mint })
  })

const turn = (preview: PreviewStore, context: {
  readonly input: AgUiSchema.RunAgentInput
  readonly text: string
  readonly run: Run
  readonly mint: Mint
}): Stream.Stream<AgUiSchema.Event> =>
  Stream.callback<AgUiSchema.Event>((queue) => {
    const { input, mint, run, text } = context
    const slice = preview.world.assistant
    const thread = threadById(slice, input.threadId)!
    const { pace, behaviour } = slice.replies
    const focus = preview.cast.agents.find((agent) => agent.id === thread.conversation.agentId) ?? null
    const reply = replyTo(mint, text, focus, slice.memories)
    const waiting: Array<Card> = []
    let current: Array<Beat> = []
    let typing = ""
    let slowTool = behaviour === "longTool"
    // Set before the run's last event: the stream closes on it, which interrupts this without anything left to keep.
    let ended = false

    const emit = (event: AgUiSchema.Event) => Queue.offer(queue, event)
    const wait = (ms: number) => ms === 0 ? Effect.void : Effect.sleep(ms)
    const checked = Effect.suspend(() => run.cancelled ? Effect.fail(new Stopped()) : Effect.void)

    // What the round got to, stored as the assistant's message.
    const store = (extra: ReadonlyArray<Beat> = []) =>
      Effect.sync(() => {
        const round = [...current, ...(typing === "" ? [] : [say(typing)]), ...extra]
        current = []
        typing = ""
        if (round.length === 0) return
        preview.update(() => appendMessage(slice, thread, message(mint, "assistant", partsOf(round), mint.at(0))))
      })

    const stream = Effect.fnUntraced(function*(beat: Beat) {
      switch (beat._tag) {
        case "Text": {
          const messageId = mint.uuid()
          yield* emit({ type: "TEXT_MESSAGE_START", messageId, role: "assistant" })
          for (const piece of pieces(beat.text)) {
            yield* checked
            yield* wait(PACE[pace].word)
            typing += piece
            yield* emit({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: piece })
          }
          yield* emit({ type: "TEXT_MESSAGE_END", messageId })
          typing = ""
          break
        }
        case "Tool": {
          const args = JSON.stringify(beat.params ?? {})
          yield* emit({ type: "TOOL_CALL_START", toolCallId: beat.id, toolCallName: beat.name })
          yield* emit({ type: "TOOL_CALL_ARGS", toolCallId: beat.id, delta: args.slice(0, args.length / 2) })
          yield* emit({ type: "TOOL_CALL_ARGS", toolCallId: beat.id, delta: args.slice(args.length / 2) })
          yield* emit({ type: "TOOL_CALL_END", toolCallId: beat.id })
          yield* wait(slowTool && pace !== "instant" ? LONG_TOOL_MS : PACE[pace].tool)
          slowTool = false
          yield* checked
          yield* emit({
            type: "TOOL_CALL_RESULT",
            messageId: mint.uuid(),
            toolCallId: beat.id,
            content: JSON.stringify(beat.result),
            ...(beat.failed === true ? { metadata: { "effect/ai": { isFailure: true } } } : {})
          })
          for (const card of beat.cards) yield* emit(cardEvent(beat.id, card))
          waiting.push(...beat.cards.filter(isPending))
          break
        }
        case "Card":
          yield* emit(cardEvent(null, beat.card))
          if (isPending(beat.card)) waiting.push(beat.card)
          break
        case "Failed":
          break
      }
      current.push(beat)
    })

    const round = Effect.fnUntraced(function*(beats: Round, step: number) {
      yield* emit({ type: "STEP_STARTED", stepName: `round-${step}` })
      for (const beat of beats) yield* stream(beat)
      yield* emit({ type: "STEP_FINISHED", stepName: `round-${step}` })
      yield* store()
    })

    // The assistant's own card, in a message of its own.
    const ownCard = Effect.fnUntraced(function*(card: Card) {
      yield* emit(cardEvent(null, card))
      if (isPending(card)) waiting.push(card)
      current = [own(card)]
      yield* store()
    })

    const errorCard = (reason: keyof typeof STOPPED): Card => ({
      _tag: "Error",
      id: mint.id("card") as CardId,
      reason,
      message: STOPPED[reason]
    })

    const finished = (outcome: AgUiSchema.RunFinishedOutcome) =>
      Effect.suspend(() => {
        ended = true
        return emit({ type: "RUN_FINISHED", threadId: input.threadId, runId: input.runId, outcome })
      })

    const spend = Effect.sync(() =>
      preview.update(() => {
        const cost = 4_000 + Math.min(text.length, 400) * 20
        slice.budget = {
          ...slice.budget,
          costMicros: slice.budget.costMicros + cost,
          inputTokens: slice.budget.inputTokens + cost * 3,
          outputTokens: slice.budget.outputTokens + Math.round(cost / 12)
        }
        if (thread.conversation.title === null) {
          thread.conversation = new Conversation({ ...thread.conversation, title: titleOf(text) })
        }
      })
    )

    const answer = Effect.gen(function*() {
      if (isSpent(slice.budget)) {
        yield* ownCard(errorCard("budget"))
        return yield* finished({ type: "success" })
      }
      yield* spend

      if (behaviour === "fails") {
        const opening = reply.rounds[0]?.find((beat) => beat._tag === "Text")
        yield* emit({ type: "STEP_STARTED", stepName: "round-1" })
        if (opening?._tag === "Text") yield* stream(say(opening.text.slice(0, Math.ceil(opening.text.length / 3))))
        const card = errorCard("unavailable")
        yield* emit(cardEvent(null, card))
        yield* store([own(card), failed(STOPPED.unavailable)])
        ended = true
        return yield* emit({ type: "RUN_ERROR", message: STOPPED.unavailable, code: "model" })
      }

      let step = 1
      for (const beats of reply.rounds) yield* round(beats, step++)
      if (behaviour === "tooManySteps") yield* ownCard(errorCard("rounds"))

      const guess = behaviour === "guesses" ?
        memoryOf(mint, { ...GUESSES[slice.counters.run % GUESSES.length]!, confirmedHoursAgo: null, hoursAgo: 0 }) :
        null
      const learned = [...reply.memories, ...(guess === null ? [] : [guess])]
      if (learned.length > 0) preview.update(() => slice.memories.unshift(...learned))
      if (guess !== null) {
        yield* ownCard({
          _tag: "Memory",
          id: mint.id("card") as CardId,
          action: "confirm",
          memory: guess,
          status: "pending"
        })
      }

      return yield* finished(
        Arr.isArrayNonEmpty(waiting) ?
          {
            type: "interrupt",
            interrupts: Arr.map(
              waiting,
              (card) => ({ id: card.id, reason: "confirmation", message: describeCard(card) })
            )
          } :
          { type: "success" }
      )
    })

    return answer.pipe(
      Effect.catchTag("Stopped", () =>
        Effect.gen(function*() {
          const card = errorCard("cancelled")
          yield* emit(cardEvent(null, card))
          yield* store([own(card)])
          yield* finished({ type: "cancelled" })
        })),
      // The reader went away mid-answer: keep what was written, as bluechip does.
      Effect.onInterrupt(() => ended ? Effect.void : store([own(errorCard("interrupted"))])),
      Effect.ensuring(Effect.sync(() => slice.runs.delete(input.runId))),
      Effect.andThen(Queue.end(queue))
    )
  })
