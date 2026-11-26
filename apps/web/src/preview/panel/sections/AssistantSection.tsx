// The panel's Chat tab: the day's budget, how the next replies behave and confirmations answer, cards and whole
// conversations to add, memories to confirm, and clearing it all.
import type { CardStatus } from "@bluechip/domain/assistant/Card"
import { useState } from "react"
import {
  BUDGET_LEVELS,
  type BudgetLevel,
  type ConfirmOutcome,
  type ReplyBehaviour,
  type ReplyPace
} from "../../world/assistant.ts"
import { CARD_KINDS, type CardKind } from "../../world/assistant/cards.ts"
import { THREAD_KINDS, type ThreadKind } from "../../world/assistant/threads.ts"
import {
  addCard,
  addConversation,
  addGuesses,
  addMemory,
  clearConversations,
  clearMemories,
  setBudget,
  setConfirms,
  setReplyBehaviour,
  setReplyPace
} from "../actions/assistant.ts"
import { Act, Group, Pick, Row, Segmented, usePreview } from "../controls.tsx"

const BEHAVIOURS: ReadonlyArray<{ readonly value: ReplyBehaviour; readonly label: string }> = [
  { value: "fits", label: "Answers what you ask" },
  { value: "longTool", label: "A tool takes 7 s" },
  { value: "fails", label: "Fails: model unavailable" },
  { value: "tooManySteps", label: "Stops: too many steps" },
  { value: "guesses", label: "Ends with a memory to confirm" }
]

/** The conversation the chat page shows now, from its address. */
const openConversation = (): string | null =>
  /^\/chat\/(conversation_[0-9a-z]+)/.exec(window.location.pathname)?.[1] ?? null

const goTo = (conversationId: string) => window.location.assign(`/chat/${conversationId}`)

export function AssistantSection() {
  const store = usePreview()
  const slice = store.world.assistant
  const [kind, setKind] = useState<CardKind>("tradeAsking")
  const [status, setStatus] = useState<CardStatus>("pending")
  const [thread, setThread] = useState<ThreadKind>("longThread")
  const confirmable = CARD_KINDS.find((known) => known.id === kind)?.confirmable ?? false
  const ratio = slice.budget.costMicros / slice.budget.limitMicros
  const level: BudgetLevel = ratio >= BUDGET_LEVELS.spent
    ? "spent"
    : ratio >= BUDGET_LEVELS.nearly
    ? "nearly"
    : "plenty"
  const pending = slice.memories.filter((memory) => memory.confirmedAt === null).length

  // The chat page reads a thread once when it opens: show the change by loading it again.
  const add = (target: "open" | "new") => {
    const open = target === "open" ? openConversation() : null
    store.act(addCard(kind, confirmable ? status : "applied", open))
    if (open !== null) window.location.reload()
    else goTo(store.world.assistant.threads[0]!.conversation.id)
  }

  const current = openConversation()
  const showcase = slice.showcase.filter((entry) => slice.threads.some((thread) => thread.conversation.id === entry.id))

  return (
    <>
      {showcase.length === 0 ?
        null :
        (
          <Group title="Showcase chats" hint="One chat per part of the chat's UI, every card and state in context.">
            <div className="grid gap-1">
              {showcase.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => goTo(entry.id)}
                  aria-current={entry.id === current ? "page" : undefined}
                  className={`cursor-pointer rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors ${
                    entry.id === current ? "bg-blue-50 text-blue" : "text-ink hover:bg-g-50"
                  }`}
                >
                  {entry.title}
                </button>
              ))}
            </div>
          </Group>
        )}
      <Group
        title="Today's budget"
        hint={`$${(slice.budget.costMicros / 1e6).toFixed(2)} of $${
          (slice.budget.limitMicros / 1e6).toFixed(2)
        } used. Spent stops every reply with a notice.`}
      >
        <Segmented<BudgetLevel>
          value={level}
          options={[
            { value: "plenty", label: "Plenty left" },
            { value: "nearly", label: "Nearly used" },
            { value: "spent", label: "Used up" }
          ]}
          onChange={(next) => store.act(setBudget(next))}
        />
      </Group>

      <Group title="Replies" hint="How the next messages you send are answered.">
        <Row label="Typing">
          <Segmented<ReplyPace>
            value={slice.replies.pace}
            options={[
              { value: "instant", label: "Instant" },
              { value: "normal", label: "Normal" },
              { value: "slow", label: "Slow" }
            ]}
            onChange={(pace) => store.act(setReplyPace(pace))}
          />
        </Row>
        <Row label="What happens">
          <Pick<ReplyBehaviour>
            label="What happens"
            value={slice.replies.behaviour}
            options={BEHAVIOURS}
            onChange={(behaviour) => store.act(setReplyBehaviour(behaviour))}
          />
        </Row>
        <Row label="Confirming a card">
          <Segmented<ConfirmOutcome>
            value={slice.confirms}
            options={[
              { value: "works", label: "Works" },
              { value: "conflict", label: "Already answered" },
              { value: "invalid", label: "No longer valid" }
            ]}
            onChange={(outcome) => store.act(setConfirms(outcome))}
          />
        </Row>
      </Group>

      <Group title="Add a card" hint="Every card the assistant shows, in any state. The page reloads to show it.">
        <Pick<CardKind>
          label="Card"
          value={kind}
          options={CARD_KINDS.map((known) => ({ value: known.id, label: known.label }))}
          onChange={setKind}
        />
        {confirmable ?
          (
            <Segmented<CardStatus>
              value={status}
              options={[
                { value: "pending", label: "Waiting" },
                { value: "applied", label: "Confirmed" },
                { value: "dismissed", label: "Dismissed" }
              ]}
              onChange={setStatus}
            />
          ) :
          null}
        <div className="flex flex-wrap gap-2">
          <Act onClick={() => add("open")}>Add to this chat</Act>
          <Act onClick={() => add("new")}>Add in a new chat</Act>
        </div>
      </Group>

      <Group title="Conversations" hint={`${slice.threads.length} in the list. Add one as the scenarios write it.`}>
        <Pick<ThreadKind>
          label="Conversation"
          value={thread}
          options={THREAD_KINDS.map((known) => ({ value: known.id, label: known.title }))}
          onChange={setThread}
        />
        <div className="flex flex-wrap gap-2">
          <Act
            onClick={() => {
              store.act(addConversation(thread))
              goTo(store.world.assistant.threads[0]!.conversation.id)
            }}
          >
            Add and open it
          </Act>
          <Act tone="danger" onClick={() => store.act(clearConversations())}>Clear all chats</Act>
        </div>
      </Group>

      <Group
        title="Memory"
        hint={`${slice.memories.length} memories, ${pending} waiting for you to confirm.`}
      >
        <div className="flex flex-wrap gap-2">
          <Act onClick={() => store.act(addGuesses())}>Add guesses to confirm</Act>
          <Act onClick={() => store.act(addMemory())}>Add a memory</Act>
          <Act tone="danger" onClick={() => store.act(clearMemories())}>Forget everything</Act>
        </div>
      </Group>
    </>
  )
}
