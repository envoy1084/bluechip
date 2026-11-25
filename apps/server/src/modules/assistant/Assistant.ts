import { isSpent } from "@bluechip/domain/assistant/Budget"
import { type Card, describeCard, isPending } from "@bluechip/domain/assistant/Card"
import { MAX_MESSAGE_LENGTH, type Message, type MessagePart } from "@bluechip/domain/assistant/Conversation"
import { CARD_EVENT, CardEvent } from "@bluechip/domain/assistant/RunEvents"
import { systemPrompt } from "@bluechip/domain/assistant/SystemPrompt"
import { NotFound } from "@bluechip/domain/Errors"
import type { ConversationId } from "@bluechip/domain/Ids"
import { Caller } from "@bluechip/domain/tools/Caller"
import * as AgUi from "effect/ai/AgUi"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import { defaultIdGenerator, IdGenerator } from "effect/ai/IdGenerator"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Prompt from "effect/ai/Prompt"
import type * as Response from "effect/ai/Response"
import * as Arr from "effect/Array"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { Agents } from "../agents/Agents.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { AssistantModels } from "./AssistantModels.ts"
import { AssistantToolkit } from "./AssistantTools.ts"
import { Budgets } from "./Budgets.ts"
import { type CardInput, Cards } from "./Cards.ts"
import { Conversations } from "./Conversations.ts"
import { Memories } from "./Memories.ts"
import { MemoryExtractor } from "./MemoryExtractor.ts"
import { promptOf, research, storedParts, toolCards, usageOf } from "./Transcript.ts"

/** The most model rounds one turn runs: each round may call tools, and the next reads their results. */
export const MAX_ROUNDS = 8

const BUDGET_SPENT = "You've used today's assistant budget, so I'll stop here. It resets at midnight UTC; " +
  "everything else in bluechip still works."
const TOO_MANY_STEPS = "That took more steps than I'm allowed in one go. Tell me what to do next and I'll carry on."
const CANCELLED = "Stopped."
const MODEL_FAILED = "The assistant couldn't answer just now. Try again in a moment."

interface Run {
  readonly userId: string
  readonly conversationId: ConversationId
  readonly cancelled: Deferred.Deferred<void>
}

/**
 * The assistant's runs: one turn of a conversation, streamed as AG-UI events. The history comes from bluechip's
 * records (never from the client), the model rounds run with the toolkit for the user, every round is stored as it
 * ends, budgets stop the model, and a turn ends with what it learned (memories) and the cards waiting for the user.
 */
export class Assistant extends Context.Service<Assistant, {
  /**
   * Starts a turn: checks the thread is the user's and not busy, applies `resume` answers to cards, stores the user's
   * message and returns the run's events. `BadRequest` before anything is stored when the input can't run.
   */
  readonly run: (
    owner: Owner,
    input: AgUiSchema.RunAgentInput
  ) => Effect.Effect<Stream.Stream<AgUiSchema.Event>, HttpApiError.BadRequest>
  /** Stops a run of the user's: the round in progress is stored as far as it got. */
  readonly cancel: (owner: Owner, runId: string) => Effect.Effect<void, NotFound>
}>()("@bluechip/server/Assistant") {
  static readonly layer = Layer.effect(
    Assistant,
    Effect.gen(function*() {
      const conversations = yield* Conversations
      const cards = yield* Cards
      const memories = yield* Memories
      const budgets = yield* Budgets
      const agents = yield* Agents
      const models = yield* AssistantModels
      const extractor = yield* MemoryExtractor
      const toolkit = yield* AssistantToolkit
      const runs = new Map<string, Run>()

      const cardEvent = (toolCallId: string | null, card: Card): AgUiSchema.Event => ({
        type: "CUSTOM",
        name: CARD_EVENT,
        value: Schema.encodeSync(Schema.toCodecJson(CardEvent.fields.value))({ toolCallId, card })
      })

      const turn = (owner: Owner, context: {
        readonly input: AgUiSchema.RunAgentInput
        readonly conversationId: ConversationId
        readonly userMessage: Message
        readonly userText: string
        readonly wantsTitle: boolean
        readonly cancelled: Deferred.Deferred<void>
      }): Stream.Stream<AgUiSchema.Event> => {
        const { conversationId, input } = context
        const caller = { id: owner.id, account: owner.account, conversationId, source: "assistant" as const }
        const waiting: Array<Card> = []

        // A card the assistant makes itself, stored in its own message.
        const ownCards = Effect.fnUntraced(function*(inputs: ReadonlyArray<CardInput>) {
          const made: Array<Card> = []
          for (const card of inputs) made.push(yield* cards.create(owner, conversationId, card))
          if (made.length > 0) {
            yield* conversations.append(conversationId, {
              role: "assistant",
              parts: made.map((card) => ({ type: "card", toolCallId: null, card }))
            })
          }
          return made
        })

        const finished = (outcome: AgUiSchema.RunFinishedOutcome): AgUiSchema.Event => ({
          type: "RUN_FINISHED",
          threadId: input.threadId,
          runId: input.runId,
          outcome
        })

        // What the turn learned, then the cards still waiting for the user, as the run's outcome.
        const finish = (learn: boolean) =>
          Stream.unwrap(Effect.gen(function*() {
            const learned = learn ?
              yield* extractor.extract(owner, {
                userText: context.userText,
                messageId: context.userMessage.id,
                wantsTitle: context.wantsTitle
              }) :
              { title: null, learned: [] }
            if (learned.title !== null) yield* conversations.setTitle(conversationId, learned.title)

            const memoryCards = yield* ownCards(learned.learned.map((memory) =>
              memory.confirmedAt === null ?
                { _tag: "Memory", action: "confirm", memory, status: "pending" } as const :
                { _tag: "Memory", action: "saved", memory, status: "applied" } as const
            ))
            waiting.push(...memoryCards.filter(isPending))

            const outcome: AgUiSchema.RunFinishedOutcome = Arr.isArrayNonEmpty(waiting) ?
              {
                type: "interrupt",
                interrupts: Arr.map(waiting, (card) => ({
                  id: card.id,
                  reason: "confirmation",
                  message: describeCard(card)
                }))
              } :
              { type: "success" }
            return Stream.fromIterable([...memoryCards.map((card) => cardEvent(null, card)), finished(outcome)])
          }))

        const stop = (reason: "budget" | "rounds", message: string) =>
          Stream.unwrap(Effect.map(
            ownCards([{ _tag: "Error", reason, message }]),
            (made) => Stream.fromIterable(made.map((card) => cardEvent(null, card)))
          )).pipe(Stream.concat(finish(reason === "rounds")))

        const round = (step: number, prompt: Prompt.Prompt): Stream.Stream<AgUiSchema.Event> =>
          Stream.unwrap(Effect.gen(function*() {
            if (isSpent(yield* budgets.today(owner))) return stop("budget", BUDGET_SPENT)

            const parts: Array<Response.AnyPart> = []
            const shown = new Map<string, ReadonlyArray<Card>>()
            let failure: unknown = undefined

            const events = models.converse(LanguageModel.streamText({ prompt, toolkit })).pipe(
              Stream.provideService(Caller, caller),
              Stream.tap((part) =>
                Effect.sync(() => {
                  parts.push(part)
                  for (const { card, toolCallId } of toolCards([part])) {
                    shown.set(toolCallId, [...(shown.get(toolCallId) ?? []), card])
                  }
                })
              ),
              Stream.interruptWhen(Deferred.await(context.cancelled)),
              Stream.catch((error) => {
                failure = error
                return Stream.empty
              }),
              AgUi.fromStreamParts,
              Stream.provideService(IdGenerator, defaultIdGenerator),
              Stream.map((event): ReadonlyArray<AgUiSchema.Event> => {
                switch (event.type) {
                  case "TOOL_CALL_RESULT":
                    return [
                      event,
                      ...(shown.get(event.toolCallId) ?? []).map((card) => cardEvent(event.toolCallId, card))
                    ]
                  case "STEP_STARTED":
                  case "STEP_FINISHED":
                    return [{ ...event, stepName: `round-${step}` }]
                  default:
                    return [event]
                }
              }),
              Stream.flattenIterable
            )

            return events.pipe(Stream.concat(Stream.unwrap(Effect.gen(function*() {
              const cancelled = yield* Deferred.isDone(context.cancelled)
              const metadata = parts.find((part) => part.type === "response-metadata")
              const model = metadata?.type === "response-metadata" && metadata.modelId !== undefined ?
                metadata.modelId :
                models.conversationModel
              const usage = usageOf(parts)
              if (parts.some((part) => part.type === "finish")) yield* budgets.record(owner, model, usage)

              const fromTools = toolCards(parts)
              const searched = research(parts)
              const extras = yield* Effect.forEach(
                [
                  ...(searched === undefined ? [] : [{ _tag: "Research", ...searched } as const]),
                  ...(cancelled ? [{ _tag: "Error", reason: "cancelled", message: CANCELLED } as const] : [])
                ],
                (card) => cards.create(owner, conversationId, card)
              )
              const stored: Array<MessagePart> = [
                ...storedParts(parts),
                ...fromTools.map(({ card, toolCallId }) => ({ type: "card" as const, toolCallId, card })),
                ...extras.map((card) => ({ type: "card" as const, toolCallId: null, card })),
                ...(failure === undefined ? [] : [{ type: "error" as const, message: MODEL_FAILED }])
              ]
              if (stored.length > 0) {
                yield* conversations.append(conversationId, {
                  role: "assistant",
                  parts: stored,
                  model,
                  usage: {
                    inputTokens: usage.inputTokens,
                    outputTokens: usage.outputTokens,
                    cacheReadTokens: usage.cacheReadTokens
                  }
                })
              }
              waiting.push(...fromTools.map(({ card }) => card).filter(isPending))
              const extraEvents = extras.map((card) => cardEvent(null, card))

              if (failure !== undefined) {
                yield* Effect.logWarning("The assistant's model failed", failure)
                return Stream.fromIterable<AgUiSchema.Event>([
                  ...extraEvents,
                  { type: "RUN_ERROR", message: MODEL_FAILED, code: "model" }
                ])
              }
              if (cancelled) return Stream.fromIterable([...extraEvents, finished({ type: "cancelled" })])

              const finish = parts.find((part) => part.type === "finish")
              const usedTools = parts.some((part) => part.type === "tool-result" && part.providerExecuted !== true)
              const goesOn = finish?.type === "finish" &&
                (finish.reason === "pause" || (finish.reason === "tool-calls" && usedTools))
              const next: Stream.Stream<AgUiSchema.Event> = !goesOn ?
                finishTurn() :
                step >= MAX_ROUNDS ?
                stop("rounds", TOO_MANY_STEPS) :
                round(step + 1, Prompt.concat(prompt, Prompt.fromResponseParts(parts)))
              return Stream.fromIterable(extraEvents).pipe(Stream.concat(next))
            }))))
          }))

        const finishTurn = () => finish(true)

        return Stream.unwrap(Effect.gen(function*() {
          const [thread, owned, remembered] = yield* Effect.all([
            conversations.thread(owner, conversationId).pipe(Effect.orDie),
            agents.list(owner),
            memories.forPrompt(owner)
          ], { concurrency: 3 })
          const focus = owned.find((agent) => agent.id === thread.conversation.agentId) ?? null
          const system = systemPrompt({
            today: DateTime.formatIsoDateUtc(yield* DateTime.now),
            agents: owned,
            memories: remembered,
            focus
          })
          const prompt = Prompt.concat(
            Prompt.make([{
              role: "system",
              content: system,
              options: { anthropic: { cacheControl: { type: "ephemeral" } } }
            }]),
            promptOf(thread.messages)
          )
          return round(1, prompt)
        })).pipe(
          Stream.withSpan("Assistant.turn", {
            attributes: {
              "gen_ai.operation.name": "chat",
              "gen_ai.conversation.id": conversationId,
              "gen_ai.request.model": models.conversationModel
            }
          })
        )
      }

      const run = Effect.fn("Assistant.run")(function*(owner: Owner, input: AgUiSchema.RunAgentInput) {
        const conversation = yield* conversations.owned(owner, input.threadId).pipe(
          Effect.mapError(() => new HttpApiError.BadRequest({}))
        )
        const busy = runs.has(input.runId) ||
          [...runs.values()].some((active) => active.conversationId === conversation.id)
        if (busy) return yield* new HttpApiError.BadRequest({})

        const last = input.messages.at(-1)
        const userText = last?.role !== "user" ?
          "" :
          (typeof last.content === "string" ?
            last.content :
            last.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")).trim()
        if (userText.length > MAX_MESSAGE_LENGTH) return yield* new HttpApiError.BadRequest({})
        if (userText.length === 0 && (input.resume ?? []).length === 0) return yield* new HttpApiError.BadRequest({})

        for (const entry of input.resume ?? []) {
          yield* (entry.status === "resolved" ? cards.confirm : cards.dismiss)(owner, entry.interruptId).pipe(
            // Answered already (another tab, or the confirm endpoint): nothing left to do.
            Effect.catchTag("Conflict", () => Effect.void),
            Effect.mapError(() => new HttpApiError.BadRequest({}))
          )
        }
        if (userText.length === 0) return Stream.empty

        const userMessage = yield* conversations.append(conversation.id, {
          role: "user",
          parts: [{ type: "text", text: userText }]
        })
        const cancelled = yield* Deferred.make<void>()
        runs.set(input.runId, { userId: owner.id, conversationId: conversation.id, cancelled })

        return turn(owner, {
          input,
          conversationId: conversation.id,
          userMessage,
          userText,
          wantsTitle: conversation.title === null,
          cancelled
        }).pipe(Stream.ensuring(Effect.sync(() => runs.delete(input.runId))))
      })

      const cancel = Effect.fn("Assistant.cancel")(function*(owner: Owner, runId: string) {
        const active = runs.get(runId)
        if (active === undefined || active.userId !== owner.id) {
          return yield* new NotFound({ resource: "run", id: runId })
        }
        yield* Deferred.succeed(active.cancelled, undefined)
      })

      return Assistant.of({ run, cancel })
    })
  )
}
