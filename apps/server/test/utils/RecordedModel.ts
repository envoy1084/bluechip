// The assistant's models in tests: recorded replies replayed by the user's message, so the loop runs exactly and free.
import type { MemoryCandidate } from "@bluechip/domain/assistant/Memory"
import type { JudgmentAnswer } from "@bluechip/domain/automations/conditions/Judgment"
import { RESEARCH_TOOL } from "@bluechip/domain/tools/Toolkit"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import type * as Prompt from "effect/ai/Prompt"
import type * as Response from "effect/ai/Response"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { AssistantModels } from "../../src/modules/assistant/AssistantModels.ts"

/**
 * One thing the model does in a round: write text (`partial`: a text block it is still writing), call a tool, search
 * the web (run by Anthropic), or go quiet as a model still answering (`hang`, the round's last step: it streams nothing
 * more until the run stops it, see `RecordedModel.cutOff`).
 */
export type Step =
  | { readonly text: string; readonly partial?: boolean }
  | { readonly hang: true }
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
  /** The conversation model can't answer: it fails with an error not worth retrying. */
  readonly conversationFails?: boolean
  /** The conversation model is rate limited this many times before it answers. */
  readonly rateLimited?: number
  /** The provider's answer can't be decoded this many times before it answers, the way Anthropic's sometimes misses `stop_details.fallback_credit_token`. */
  readonly undecodable?: number
  /**
   * The notes after the turn: the memories the conversation model notes, and the title the small model gives a new
   * conversation (the message's first words when `null` or absent).
   */
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
  /** Waits until the run answering `to` stopped the model in a `hang` step. */
  readonly cutOff: (to: string) => Effect.Effect<void>
  /** Records the small model's answer to judgments about the story with this headline. */
  readonly judge: (headline: string, answer: JudgmentAnswer) => Effect.Effect<void>
  /** The prompts the small model was sent to judge the story with this headline. */
  readonly judgmentPrompts: (headline: string) => Effect.Effect<ReadonlyArray<Prompt.Prompt>>
}>()("@bluechip/server/test/RecordedModel") {
  /** The recordings and the `AssistantModels` that replay them. */
  static readonly layer = Layer.unwrap(Effect.sync(() => {
    const replies = new Map<string, Reply>()
    const sent = new Map<string, Array<Prompt.Prompt>>()
    const limits = new Map<string, number>()
    const undecoded = new Map<string, number>()
    const hangs = new Map<string, Deferred.Deferred<void>>()
    const judgments = new Map<string, JudgmentAnswer>()
    const judged = new Map<string, Array<Prompt.Prompt>>()
    const hangOf = (to: string) => {
      const known = hangs.get(to)
      if (known !== undefined) return known
      const made = Deferred.makeUnsafe<void>()
      hangs.set(to, made)
      return made
    }
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
        if ("hang" in step) {
          return parts
        } else if ("text" in step) {
          const id = nextId("text")
          parts.push({ type: "text-start", id }, { type: "text-delta", id, delta: step.text })
          if (step.partial !== true) parts.push({ type: "text-end", id })
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
          Effect.suspend(() => {
            // A judgment about the story whose headline the prompt carries.
            if (options.responseFormat.type === "json" && options.responseFormat.objectName === "judgment") {
              const prompt = options.prompt.content.map(textOf).join("\n")
              const headline = /^Headline: (.*)$/m.exec(prompt)?.[1] ?? ""
              judged.set(headline, [...(judged.get(headline) ?? []), options.prompt])
              const answer = judgments.get(headline)
              if (answer === undefined) return Effect.fail(failure(`No judgment recorded for "${headline}"`))
              return Effect.succeed(
                [
                  { type: "text", text: JSON.stringify(answer) },
                  {
                    type: "finish",
                    reason: "stop",
                    usage: { inputTokens: { uncached: 300, total: 300 }, outputTokens: { total: 30 } }
                  }
                ] satisfies Array<Response.PartEncoded>
              )
            }

            const prompt = options.prompt.content.map(textOf).join("\n")

            // A conversation's summary: what the user said in the transcript, in order.
            if (
              options.responseFormat.type === "json" && options.responseFormat.objectName === "conversation_summary"
            ) {
              const transcript = /<transcript>\n([\s\S]*)\n<\/transcript>/.exec(prompt)?.[1] ?? ""
              const said = transcript.split("\n").flatMap((line) => line.startsWith("User: ") ? [line.slice(6)] : [])
              return Effect.succeed(
                [
                  { type: "text", text: JSON.stringify({ summary: `The user said: ${said.join(" Then: ")}` }) },
                  {
                    type: "finish",
                    reason: "stop",
                    usage: { inputTokens: { uncached: 400, total: 400 }, outputTokens: { total: 40 } }
                  }
                ] satisfies Array<Response.PartEncoded>
              )
            }

            // A turn's notes or a conversation's title, for the message quoted between the tags.
            const quoted = /<user_message>\n([\s\S]*)\n<\/user_message>/.exec(prompt)?.[1] ?? ""
            const notes = replies.get(quoted)?.notes
            const answer =
              options.responseFormat.type === "json" && options.responseFormat.objectName === "conversation_title" ?
                { title: notes?.title ?? quoted.slice(0, 30) } :
                { memories: notes?.memories ?? [] }
            return Effect.succeed(
              [
                { type: "text", text: JSON.stringify(answer) },
                {
                  type: "finish",
                  reason: "stop",
                  usage: { inputTokens: { uncached: 200, total: 200 }, outputTokens: { total: 20 } }
                }
              ] satisfies Array<Response.PartEncoded>
            )
          }),
        streamText: (options) =>
          Stream.unwrap(Effect.sync(() => {
            const { round, user } = locate(options.prompt)
            const reply = replies.get(user)
            if (reply === undefined) return Stream.fail(failure(`No recording answers "${user}"`))
            if (modelId === CONVERSATION_MODEL && reply.conversationFails === true) {
              return Stream.fail(failure("The recorded conversation model is down"))
            }
            const limited = limits.get(user) ?? 0
            if (modelId === CONVERSATION_MODEL && limited < (reply.rateLimited ?? 0)) {
              limits.set(user, limited + 1)
              return Stream.fail(
                AiError.make({ module: "RecordedModel", method: "streamText", reason: new AiError.RateLimitError({}) })
              )
            }
            const failedDecodes = undecoded.get(user) ?? 0
            if (modelId === CONVERSATION_MODEL && failedDecodes < (reply.undecodable ?? 0)) {
              undecoded.set(user, failedDecodes + 1)
              return Stream.fail(AiError.make({
                module: "AnthropicClient",
                method: "createMessageStream",
                reason: new AiError.InvalidResponseError({
                  description: "Missing key\n  at [\"stop_details\"][\"fallback_credit_token\"]"
                })
              }))
            }
            sent.set(user, [...(sent.get(user) ?? []), options.prompt])
            const steps = reply.rounds[round]
            if (steps === undefined) return Stream.fail(failure(`No round ${round + 1} for "${user}"`))
            const streamed = Stream.fromIterable(encode(steps, modelId, reply.usage))
            if (!steps.some((step) => "hang" in step)) return streamed
            return streamed.pipe(
              Stream.concat(Stream.never),
              Stream.ensuring(Deferred.succeed(hangOf(user), undefined))
            )
          }))
      })

    const conversation = Layer.effect(LanguageModel.LanguageModel, model(CONVERSATION_MODEL))
    const small = Layer.effect(LanguageModel.LanguageModel, model(SMALL_MODEL))

    return Layer.mergeAll(
      Layer.succeed(RecordedModel, {
        record: (...recorded) => Effect.sync(() => recorded.forEach((reply) => replies.set(reply.to, reply))),
        prompts: (to) => Effect.sync(() => sent.get(to) ?? []),
        cutOff: (to) => Effect.suspend(() => Deferred.await(hangOf(to))),
        judge: (headline, answer) => Effect.sync(() => void judgments.set(headline, answer)),
        judgmentPrompts: (headline) => Effect.sync(() => judged.get(headline) ?? [])
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
