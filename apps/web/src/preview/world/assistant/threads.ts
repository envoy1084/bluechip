// The scenario's conversations as stored threads, one script per kind of conversation. A guess the assistant made in
// a conversation (an unconfirmed memory from its time) ends it with a card asking you to confirm it.
import { Conversation, type Message } from "@bluechip/domain/assistant/Conversation"
import type { Memory } from "@bluechip/domain/assistant/Memory"
import type { CardId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"
import type { CastConversation } from "../cast.ts"
import type { Mint } from "./mint.ts"
import { messagesOf, own, type ThreadContext, type Turn } from "./rounds.ts"
import { approval } from "./threads/approval.ts"
import { automationSetup } from "./threads/automationSetup.ts"
import { buyIdea } from "./threads/buyIdea.ts"
import { longThread } from "./threads/longThread.ts"
import { newAgent } from "./threads/newAgent.ts"
import { research } from "./threads/research.ts"
import { welcome } from "./threads/welcome.ts"

/** A conversation and its messages, oldest first. */
export interface Thread {
  conversation: Conversation
  messages: Array<Message>
}

export type ThreadKind = CastConversation["kind"]

export const THREAD_KINDS: ReadonlyArray<{ readonly id: ThreadKind; readonly title: string }> = [
  { id: "welcome", title: "What is bluechip?" },
  { id: "buyIdea", title: "Buy some Nvidia" },
  { id: "newAgent", title: "Set up a weekly buyer" },
  { id: "automationSetup", title: "Protect my Tesla" },
  { id: "approval", title: "Approve the rebalance" },
  { id: "research", title: "How is Microsoft doing?" },
  { id: "longThread", title: "Planning my portfolio" }
]

const SCRIPTS: Readonly<Record<ThreadKind, (context: ThreadContext) => ReadonlyArray<Turn>>> = {
  welcome,
  buyIdea,
  newAgent,
  automationSetup,
  approval,
  research,
  longThread
}

const HOUR = 3_600_000

/** `conversation` as stored, written for the scenario with its memories. */
export const threadOf = (mint: Mint, conversation: CastConversation, memories: ReadonlyArray<Memory>): Thread => {
  const turns = SCRIPTS[conversation.kind]({ mint, conversation, memories })
  const when = DateTime.toEpochMillis(mint.at(conversation.hoursAgo))
  const guesses = memories.filter((memory) =>
    memory.confirmedAt === null && Math.abs(DateTime.toEpochMillis(memory.createdAt) - when) < HOUR
  )
  const last = turns.at(-1)
  const asked = last === undefined || guesses.length === 0 ? turns : [
    ...turns.slice(0, -1),
    {
      ...last,
      rounds: [
        ...last.rounds,
        guesses.map((memory) =>
          own({ _tag: "Memory", id: mint.id("card") as CardId, action: "confirm", memory, status: "pending" })
        )
      ]
    }
  ]

  const messages = messagesOf(mint, conversation.hoursAgo, asked)
  return {
    conversation: new Conversation({
      id: conversation.id,
      agentId: conversation.agentId,
      surface: "web",
      title: conversation.title,
      createdAt: messages[0]?.createdAt ?? mint.at(conversation.hoursAgo),
      updatedAt: messages.at(-1)?.createdAt ?? mint.at(conversation.hoursAgo)
    }),
    messages
  }
}
