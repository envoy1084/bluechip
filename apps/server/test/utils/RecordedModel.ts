// The assistant's models in tests: recorded replies replayed by the user's message, so the loop runs exactly and free.
import type { MemoryCandidate } from "@bluechip/domain/assistant/Memory"
import { RESEARCH_TOOL } from "@bluechip/domain/tools/Toolkit"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import type * as Prompt from "effect/ai/Prompt"
import type * as Response from "effect/ai/Response"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { AssistantModels } from "../../src/modules/assistant/AssistantModels.ts"

/** One thing the model does in a round: write text, call a tool, or search the web (run by Anthropic). */
export type Step =
  | { readonly text: string }
  | { readonly call: string; readonly params: object }
  | {
    readonly search: string
    readonly results: ReadonlyArray<{ readonly url: string; readonly title: string; readonly citedText?: string }>
  }

/** The model's recorded answer to one user message. */
export interface Reply {
  /** The user's message it answers, word for word. */
  readonly to: string
  /** The steps of each model round, in order: a round after tool calls reads their results. */
  readonly rounds: ReadonlyArray<ReadonlyArray<Step>>
  /** The conversation model fails before streaming, so the small model answers instead. */
  readonly conversationFails?: boolean
  /** What the small model notes after the turn (no title and no memories when absent). */
  readonly notes?: { readonly title: string | null; readonly memories: ReadonlyArray<MemoryCandidate> }
  /** Tokens each round reports (1,000 in and 100 out when absent). */
  readonly usage?: { readonly input: number; readonly output: number }
}

/** The model ids the recorded models report, as messages store them. */
export const CONVERSATION_MODEL = "test-conversation"
export const SMALL_MODEL = "test-small"

const textOf = (message: Prompt.Message): string =>
  typeof message.content === "string" ?
    message.content :
    (message.content as ReadonlyArray<{ readonly type: string; readonly text?: string }>)
      .flatMap((part) => part.type === "text" && part.text !== undefined ? [part.text] : []).join("\n")

export class RecordedModel extends Context.Service<RecordedModel, {
  /** Adds replies for the models to replay. */
  readonly record: (...replies: ReadonlyArray<Reply>) => Effect.Effect<void>
  /** The prompts the conversation model was sent for a user message, one per round. */
  readonly prompts: (to: string) => Effect.Effect<ReadonlyArray<Prompt.Prompt>>
}>()("@bluechip/server/test/RecordedModel") {
  /** The recordings and the `AssistantModels` that replay them. */
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const replies = new Map<string, Reply>()
    const sent = new Map<string, Array<Prompt.Prompt>>()
    let ids = 0
    const nextId = (prefix: string) => `${prefix}_${++ids}`

    const failure = (description: string) =>
      AiError.make({ module: "RecordedModel", method: "streamText", reason: new AiError.UnknownError({ description }) })

    // The user's latest message, and how many model rounds already answered it.
    const locate = (prompt: Prompt.Prompt) => {
      const last = prompt.content.findLastIndex((message) => message.role === "user")
      const user = last === -1 ? "" : textOf(prompt.content[last]!)
      const round = prompt.content.slice(last + 1).filter((message) => message.role === "assistant").length
      return { user, round }
    }

    const encode = (
      steps: ReadonlyArray<Step>,
      modelId: string,
      usage: Reply["usage"]
    ): ReadonlyArray<Response.StreamPartEncoded> => {
      const parts: Array<Response.StreamPartEncoded> = [{ type: "response-metadata", id: nextId("msg"), modelId }]
      let calls = 0
      for (const step of steps) {
        if ("text" in step) {
          const id = nextId("text")
          parts.push({ type: "text-start", id }, { type: "text-delta", id, delta: step.text }, { type: "text-end", id })
        } else if ("call" in step) {
          calls++
          parts.push({ type: "tool-call", id: nextId("toolu"), name: step.call, params: step.params })
        } else {
          const id = nextId("srvtoolu")
          parts.push(
            { type: "tool-call", id, name: RESEARCH_TOOL, params: { query: step.search }, providerExecuted: true },
            {
              type: "tool-result",
              id,
              name: RESEARCH_TOOL,
              isFailure: false,
              providerExecuted: true,
              result: step.results.map((result) => ({
                type: "web_search_result",
                url: result.url,
                title: result.title,
                encrypted_content: "recorded",
                page_age: null
              }))
            },
            ...step.results.map((result): Response.StreamPartEncoded => ({
              type: "source",
              sourceType: "url",
              id: nextId("source"),
              url: result.url,
              title: result.title,
              metadata: result.citedText === undefined
                ? {}
                : { anthropic: { source: "url", citedText: result.citedText, encryptedIndex: "recorded" } }
            }))
          )
        }
      }
      parts.push({
        type: "finish",
        reason: calls > 0 ? "tool-calls" : "stop",
        usage: {
          inputTokens: { uncached: usage?.input ?? 1000, total: usage?.input ?? 1000, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: usage?.output ?? 100 }
        }
      })
      return parts
    }

    const model = (modelId: string) =>
      LanguageModel.make({
        generateText: (options) =>
          Effect.sync(() => {
            // The small model's notes after a turn, for the message quoted between the tags.
            const prompt = options.prompt.content.map(textOf).join("\n")
            const quoted = /<user_message>\n([\s\S]*)\n<\/user_message>/.exec(prompt)?.[1] ?? ""
            const notes = replies.get(quoted)?.notes ?? { title: null, memories: [] }
            return [
              { type: "text", text: JSON.stringify(notes) },
              {
                type: "finish",
                reason: "stop",
                usage: { inputTokens: { uncached: 200, total: 200 }, outputTokens: { total: 20 } }
              }
            ] satisfies Array<Response.PartEncoded>
          }),
        streamText: (options) =>
          Stream.unwrap(Effect.sync(() => {
            const { round, user } = locate(options.prompt)
            const reply = replies.get(user)
            if (reply === undefined) return Stream.fail(failure(`No recording answers "${user}"`))
            if (modelId === CONVERSATION_MODEL && reply.conversationFails === true) {
              return Stream.fail(failure("The recorded conversation model is down"))
            }
            sent.set(user, [...(sent.get(user) ?? []), options.prompt])
            const steps = reply.rounds[round]
            if (steps === undefined) return Stream.fail(failure(`No round ${round + 1} for "${user}"`))
            return Stream.fromIterable(encode(steps, modelId, reply.usage))
          }))
      })

    const conversation = Layer.effect(LanguageModel.LanguageModel, model(CONVERSATION_MODEL))
    const small = Layer.effect(LanguageModel.LanguageModel, model(SMALL_MODEL))

    return Layer.mergeAll(
      Layer.succeed(RecordedModel, {
        record: (...recorded) => Effect.sync(() => recorded.forEach((reply) => replies.set(reply.to, reply))),
        prompts: (to) => Effect.sync(() => sent.get(to) ?? [])
      }),
      Layer.succeed(
        AssistantModels,
        AssistantModels.make({
          conversation: { id: CONVERSATION_MODEL, layer: conversation },
          small: { id: SMALL_MODEL, layer: small }
        })
      )
    )
  }))
}
