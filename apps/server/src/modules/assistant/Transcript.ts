// Conversions between what the model streams, what bluechip stores, and what the model reads back: a stored
// conversation is the only history a run sends, so these decide what the model remembers of earlier turns.
import type { TokenUsage } from "@bluechip/domain/assistant/Budget"
import { Card, type Citation, describeCard } from "@bluechip/domain/assistant/Card"
import type { Message, MessagePart } from "@bluechip/domain/assistant/Conversation"
import { RESEARCH_TOOL } from "@bluechip/domain/tools/Toolkit"
import * as Prompt from "effect/ai/Prompt"
import type * as Response from "effect/ai/Response"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

const isCard = Schema.is(Card)

/**
 * A model round's parts as stored: its text, thinking (with the provider options that let it be sent back), tool
 * calls and their results. A tool call without a result (the round was cancelled mid-call) is dropped, since the model
 * can't be shown a call that never answered.
 */
export const storedParts = (parts: ReadonlyArray<Response.AnyPart>): ReadonlyArray<MessagePart> => {
  const stored: Array<MessagePart> = []
  for (const message of Prompt.fromResponseParts(parts).content) {
    if (message.role !== "assistant" && message.role !== "tool") continue
    for (const part of message.content) {
      switch (part.type) {
        case "text":
          stored.push({ type: "text", text: part.text })
          break
        case "reasoning":
          stored.push({ type: "reasoning", text: part.text, options: part.options })
          break
        case "tool-call":
          stored.push({
            type: "toolCall",
            id: part.id,
            name: part.name,
            params: part.params,
            providerExecuted: part.providerExecuted
          })
          break
        case "tool-result":
          stored.push({
            type: "toolResult",
            id: part.id,
            name: part.name,
            result: part.result,
            isFailure: part.isFailure,
            providerExecuted: part.providerExecuted,
            modelOutput: part.modelOutput === undefined ? null : Prompt.toolModelOutputToText(part.modelOutput)
          })
          break
      }
    }
  }

  const answered = new Set(stored.flatMap((part) => part.type === "toolResult" ? [part.id] : []))
  return stored.filter((part) => part.type !== "toolCall" || answered.has(part.id))
}

/** The cards a round's tool results carry, with the tool call that made each. */
export const toolCards = (
  parts: ReadonlyArray<Response.AnyPart>
): ReadonlyArray<{ readonly toolCallId: string; readonly card: Card }> =>
  parts.flatMap((part) => {
    if (part.type !== "tool-result" || part.isFailure || part.preliminary === true) return []
    const results: ReadonlyArray<unknown> = Array.isArray(part.result) ? part.result : [part.result]
    return results.filter(isCard).map((card) => ({ toolCallId: part.id as string, card }))
  })

/** What a round of web search read: the query and the pages cited, each once. `undefined` when it searched nothing. */
export const research = (
  parts: ReadonlyArray<Response.AnyPart>
): { readonly query: string; readonly citations: ReadonlyArray<Citation> } | undefined => {
  const search = parts.find((part) => part.type === "tool-call" && part.name === RESEARCH_TOOL)
  if (search === undefined || search.type !== "tool-call") return undefined

  const citations = new Map<string, Citation>()
  for (const part of parts) {
    if (part.type !== "source" || part.sourceType !== "url") continue
    const url = part.url.toString()
    const cited = part.metadata["anthropic"]
    const citedText = Predicate.hasProperty(cited, "citedText") && Predicate.isString(cited.citedText) ?
      cited.citedText :
      null
    const known = citations.get(url)
    if (known === undefined || (known.citedText === null && citedText !== null)) {
      citations.set(url, { url, title: part.title, citedText })
    }
  }
  const params = search.params
  const query = Predicate.hasProperty(params, "query") && Predicate.isString(params.query) ? params.query : ""
  return { query, citations: [...citations.values()] }
}

/** Tokens as budgets count them: input at full price, output, and cache reads and writes. */
export const tokenUsage = (usage: Response.Usage): TokenUsage => {
  const cacheReadTokens = usage.inputTokens.cacheRead ?? 0
  const cacheWriteTokens = usage.inputTokens.cacheWrite ?? 0
  return {
    inputTokens: usage.inputTokens.uncached ??
      Math.max(0, (usage.inputTokens.total ?? 0) - cacheReadTokens - cacheWriteTokens),
    outputTokens: usage.outputTokens.total ?? 0,
    cacheReadTokens,
    cacheWriteTokens
  }
}

/** What a round used, from its finish part; nothing when the provider reported none. */
export const usageOf = (parts: ReadonlyArray<Response.AnyPart>): TokenUsage => {
  const finish = parts.find((part) => part.type === "finish")
  return finish?.type === "finish" ?
    tokenUsage(finish.usage) :
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

/**
 * A stored conversation as the model reads it. Each tool result is given as the model was first given it, except
 * that a card's words are written again from the card as it stands now, so the model knows what the user did with
 * it (confirmed, dismissed). Cards and errors themselves are the user's view and are left out.
 */
export const promptOf = (messages: ReadonlyArray<Message>): Prompt.Prompt => {
  const encoded: Array<Prompt.MessageEncoded> = []

  for (const message of messages) {
    if (message.role === "user") {
      const text = message.parts.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")
      if (text.length > 0) encoded.push({ role: "user", content: text })
      continue
    }

    const cards = new Map<string, Card>()
    for (const part of message.parts) {
      if (part.type === "card" && part.toolCallId !== null) cards.set(part.toolCallId, part.card)
    }

    const assistant: Array<Prompt.AssistantMessagePartEncoded> = []
    const results: Array<Prompt.ToolResultPartEncoded> = []
    for (const part of message.parts) {
      switch (part.type) {
        case "text":
          assistant.push({ type: "text", text: part.text })
          break
        case "reasoning":
          assistant.push({ type: "reasoning", text: part.text, options: part.options as Prompt.ProviderOptions })
          break
        case "toolCall":
          assistant.push({
            type: "tool-call",
            id: part.id,
            name: part.name,
            params: part.params,
            providerExecuted: part.providerExecuted
          })
          break
        case "toolResult": {
          const card = cards.get(part.id)
          const text = card === undefined ? part.modelOutput : describeCard(card)
          const result: Prompt.ToolResultPartEncoded = {
            type: "tool-result",
            id: part.id,
            name: part.name,
            result: part.result,
            isFailure: part.isFailure,
            providerExecuted: part.providerExecuted,
            ...(text === null ? {} : { modelOutput: [{ type: "text", text }] })
          }
          if (part.providerExecuted) assistant.push(result)
          else results.push(result)
          break
        }
      }
    }
    if (assistant.length > 0) encoded.push({ role: "assistant", content: assistant })
    if (results.length > 0) encoded.push({ role: "tool", content: results })
  }
  return Prompt.make(encoded)
}
