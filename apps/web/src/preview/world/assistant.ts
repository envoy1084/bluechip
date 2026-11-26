// The preview world's assistant slice: the conversations and their threads, what the assistant remembers, the day's
// budget, and how the next runs and card confirmations behave (set from the panel). Records are made from the cast,
// so a conversation about an agent names one the agents pages show.
import type { Card } from "@bluechip/domain/assistant/Card"
import { Conversation, Message } from "@bluechip/domain/assistant/Conversation"
import type { ConversationSummary, Memory } from "@bluechip/domain/assistant/Memory"
import type { ConversationId, TradeId } from "@bluechip/domain/Ids"
import { sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { Trade } from "@bluechip/domain/trading/Trade"
import * as DateTime from "effect/DateTime"
import { priceOf } from "./assistant/castRecords.ts"
import { memoriesOf, summariesOf } from "./assistant/memories.ts"
import { type Counters, makeMint } from "./assistant/mint.ts"
import { showcasesOf } from "./assistant/showcase.ts"
import { type Thread, threadOf } from "./assistant/threads.ts"
import type { Cast } from "./cast.ts"

/** How fast a run types: at once (for tests), as the model does, or slowly enough to watch every part arrive. */
export type ReplyPace = "instant" | "normal" | "slow"

/**
 * What a run does: answer what you asked, call a tool that takes long, fail (the model unavailable), run out of
 * steps, or end asking you to confirm something it guessed about you.
 */
export type ReplyBehaviour = "fits" | "longTool" | "fails" | "tooManySteps" | "guesses"

/** What confirming a card answers: it works, it was answered already, or the automation no longer fits. */
export type ConfirmOutcome = "works" | "conflict" | "invalid"

/** The day's spend as a share of the limit. */
export const BUDGET_LEVELS = { plenty: 0.12, nearly: 0.93, spent: 1 } as const

export type BudgetLevel = keyof typeof BUDGET_LEVELS

export interface Run {
  readonly conversationId: ConversationId
  cancelled: boolean
}

export interface AssistantSlice {
  /** Newest first. */
  threads: Array<Thread>
  /** The showcase conversations, for the panel to open: one per family of the chat's UI. */
  readonly showcase: ReadonlyArray<{ readonly id: ConversationId; readonly title: string }>
  memories: Array<Memory>
  summaries: Array<ConversationSummary>
  budget: { inputTokens: number; outputTokens: number; costMicros: number; readonly limitMicros: number }
  replies: { pace: ReplyPace; behaviour: ReplyBehaviour }
  confirms: ConfirmOutcome
  /** The runs streaming now, by run id. */
  readonly runs: Map<string, Run>
  readonly counters: Counters
}

const LIMIT_MICROS = 1_000_000

/** The budget at `level` of the day's limit, with tokens to match. */
export const budgetAt = (level: number): AssistantSlice["budget"] => {
  const costMicros = Math.round(LIMIT_MICROS * level)
  return {
    inputTokens: costMicros * 3,
    outputTokens: Math.round(costMicros / 12),
    costMicros,
    limitMicros: LIMIT_MICROS
  }
}

export const makeAssistant = (cast: Cast, now: Date): AssistantSlice => {
  const counters: Counters = { seed: 0, action: 0, run: 0 }
  const mint = makeMint(cast, now, counters, "seed")
  const memories = memoriesOf(mint, cast)

  const threads = cast.conversations.map((conversation) => threadOf(mint, conversation, memories))
  const showcase = showcasesOf(cast).map((entry) => {
    const id = mint.id("conversation") as ConversationId
    const conversation = {
      id,
      title: entry.title,
      agentId: entry.agentId,
      kind: "welcome",
      hoursAgo: entry.hoursAgo
    } as const
    return threadOf(mint, conversation, memories, entry.script)
  })

  return {
    threads: [...threads, ...showcase].sort((a, b) =>
      DateTime.toEpochMillis(b.conversation.updatedAt) - DateTime.toEpochMillis(a.conversation.updatedAt)
    ),
    showcase: showcase.map((thread) => ({ id: thread.conversation.id, title: thread.conversation.title ?? "" })),
    memories,
    summaries: summariesOf(mint, cast),
    budget: budgetAt(
      cast.scenario === "heavy"
        ? BUDGET_LEVELS.nearly
        : cast.scenario === "typical"
        ? 0.08
        : cast.scenario === "starter"
        ? 0.03
        : 0
    ),
    replies: { pace: "normal", behaviour: "fits" },
    confirms: "works",
    runs: new Map(),
    counters
  }
}

export const threadById = (slice: AssistantSlice, id: string): Thread | undefined =>
  slice.threads.find((thread) => thread.conversation.id === id)

/** The card with `id` as it stands, wherever it was shown. */
export const findCard = (slice: AssistantSlice, id: string): Card | undefined => {
  for (const thread of slice.threads) {
    for (const message of thread.messages) {
      for (const part of message.parts) if (part.type === "card" && part.card.id === id) return part.card
    }
  }
  return undefined
}

/**
 * The fill of a trade a chat card shows as filled, for its receipt: made from the card's intent at the stock's price,
 * since the scenario's threads aren't the account's trades (they'd change its money and its activity).
 */
export const chatTrade = (slice: AssistantSlice, id: TradeId): Trade | undefined => {
  for (const thread of slice.threads) {
    for (const message of thread.messages) {
      for (const part of message.parts) {
        if (part.type !== "card" || part.card._tag !== "Trade") continue
        const { intent } = part.card
        if (intent.tradeId !== id || intent.status !== "filled") continue
        const price = priceOf(intent.leg.symbol)
        const usdc = "usdc" in intent.leg.amount ? intent.leg.amount.usdc : valueOf(intent.leg.amount.shares, price)
        return new Trade({
          id,
          agentId: intent.agentId,
          symbol: intent.leg.symbol,
          side: intent.leg.side,
          status: "filled",
          usdc: Usdc.make(usdc),
          shares: "shares" in intent.leg.amount ? intent.leg.amount.shares : sharesFor(usdc, price),
          price,
          reference: price,
          referenceStatus: "live",
          gapBps: 8,
          txHash: `0x${id.replace(/[^0-9a-f]/gu, "").padStart(64, "c").slice(-64)}` as Trade["txHash"],
          createdAt: intent.createdAt,
          settledAt: intent.updatedAt
        })
      }
    }
  }
  return undefined
}

/** Puts `card` in place of the card with its id, wherever it was shown. */
export const saveCard = (slice: AssistantSlice, card: Card): Card => {
  for (const thread of slice.threads) {
    thread.messages = thread.messages.map((message) =>
      message.parts.some((part) => part.type === "card" && part.card.id === card.id) ?
        new Message({
          ...message,
          parts: message.parts.map((part) =>
            part.type === "card" && part.card.id === card.id ? { ...part, card } : part
          )
        }) :
        message
    )
  }
  return card
}

/** Adds `message` to the end of `thread`, which moves it to the top of the list. */
export const appendMessage = (slice: AssistantSlice, thread: Thread, message: Message) => {
  thread.messages.push(message)
  thread.conversation = new Conversation({ ...thread.conversation, updatedAt: message.createdAt })
  slice.threads = [thread, ...slice.threads.filter((other) => other !== thread)]
}

/** The day the budget counts, as the server says it. */
export const budgetDay = (): string => DateTime.formatIsoDateUtc(DateTime.makeUnsafe(Date.now()))
