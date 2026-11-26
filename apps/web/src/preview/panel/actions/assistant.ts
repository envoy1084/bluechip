// The panel's assistant actions: the day's budget, how replies and card confirmations behave, cards and whole
// conversations added, guesses to confirm, and clearing chats or memories. Saved across reloads.
import type { CardStatus } from "@bluechip/domain/assistant/Card"
import { Conversation } from "@bluechip/domain/assistant/Conversation"
import type { ConversationId } from "@bluechip/domain/Ids"
import { type ActionDef, defineAction } from "../../store.ts"
import {
  appendMessage,
  BUDGET_LEVELS,
  budgetAt,
  type BudgetLevel,
  type ConfirmOutcome,
  type ReplyBehaviour,
  type ReplyPace,
  threadById
} from "../../world/assistant.ts"
import { CARD_KINDS, type CardKind, makeCard, roundOf } from "../../world/assistant/cards.ts"
import { GUESSES, memoryOf } from "../../world/assistant/memories.ts"
import { makeMint } from "../../world/assistant/mint.ts"
import { message, partsOf } from "../../world/assistant/rounds.ts"
import { THREAD_KINDS, type ThreadKind, threadOf } from "../../world/assistant/threads.ts"
import type { CastAgent } from "../../world/cast.ts"
import type { World } from "../../world/World.ts"

const mintOf = (world: World) => makeMint(world.cast, new Date(), world.assistant.counters, "action")

export const setBudget = defineAction("assistant.setBudget", (world, level) => {
  world.assistant.budget = budgetAt(BUDGET_LEVELS[level as BudgetLevel])
})

export const setReplyPace = defineAction("assistant.setReplyPace", (world, pace) => {
  world.assistant.replies.pace = pace as ReplyPace
})

export const setReplyBehaviour = defineAction("assistant.setReplyBehaviour", (world, behaviour) => {
  world.assistant.replies.behaviour = behaviour as ReplyBehaviour
})

export const setConfirms = defineAction("assistant.setConfirms", (world, outcome) => {
  world.assistant.confirms = outcome as ConfirmOutcome
})

/**
 * Adds a card of `kind` in `status` to the conversation `conversationId`, or to a new one. A conversation started live
 * isn't kept across reloads, so played again it is made anew with its id, and the page finds it.
 */
export const addCard = defineAction("assistant.addCard", (world, kind, status, conversationId) => {
  const slice = world.assistant
  const mint = mintOf(world)
  const open = typeof conversationId === "string" ? threadById(slice, conversationId) : undefined
  const focus = world.cast.agents.find((agent) => agent.id === open?.conversation.agentId) ?? null
  const made = makeCard(mint, kind as CardKind, status as CardStatus, focus)

  const thread = open ?? {
    conversation: new Conversation({
      id: (typeof conversationId === "string" ? conversationId : mint.id("conversation")) as ConversationId,
      agentId: null,
      surface: "web",
      title: CARD_KINDS.find((known) => known.id === kind)?.label ?? "A card",
      createdAt: mint.at(0),
      updatedAt: mint.at(0)
    }),
    messages: []
  }
  if (open === undefined) slice.threads.unshift(thread)
  appendMessage(slice, thread, message(mint, "assistant", partsOf(roundOf(mint, made)), mint.at(0)))
  slice.memories.unshift(...made.memories)
})

const AGENT_FOR: Readonly<Record<ThreadKind, (agent: CastAgent) => boolean>> = {
  welcome: () => false,
  buyIdea: (agent) => agent.template === "stockPicker",
  newAgent: () => false,
  automationSetup: (agent) => agent.template === "stopLossGuard",
  approval: (agent) => agent.template === "rebalancer",
  research: () => false,
  longThread: () => false
}

/** Adds a whole conversation of `kind`, as the scenarios write it, at the top of the list. */
export const addConversation = defineAction("assistant.addConversation", (world, kind) => {
  const mint = mintOf(world)
  const known = THREAD_KINDS.find((candidate) => candidate.id === kind) ?? THREAD_KINDS[0]!
  const thread = threadOf(mint, {
    id: mint.id("conversation") as ConversationId,
    title: known.title,
    agentId: world.cast.agents.find(AGENT_FOR[known.id])?.id ?? null,
    kind: known.id,
    hoursAgo: 0
  }, world.assistant.memories)
  world.assistant.threads.unshift(thread)
})

export const addGuesses = defineAction("assistant.addGuesses", (world) => {
  const mint = mintOf(world)
  world.assistant.memories.unshift(
    ...GUESSES.map((guess) => memoryOf(mint, { ...guess, confirmedHoursAgo: null, hoursAgo: 0 }))
  )
})

export const addMemory = defineAction("assistant.addMemory", (world) => {
  world.assistant.memories.unshift(memoryOf(mintOf(world), {
    kind: "constraint",
    text: "You never buy more than $500 of one stock in a day.",
    source: "said",
    confidence: 1,
    confirmedHoursAgo: 0,
    hoursAgo: 0
  }))
})

export const clearConversations = defineAction("assistant.clearConversations", (world) => {
  world.assistant.threads = []
})

export const clearMemories = defineAction("assistant.clearMemories", (world) => {
  world.assistant.memories = []
  world.assistant.summaries = []
})

export const ASSISTANT_ACTIONS: ReadonlyArray<ActionDef> = [
  setBudget,
  setReplyPace,
  setReplyBehaviour,
  setConfirms,
  addCard,
  addConversation,
  addGuesses,
  addMemory,
  clearConversations,
  clearMemories
].map((action) => action.def)
