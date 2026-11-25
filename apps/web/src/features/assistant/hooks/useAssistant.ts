import type { Card } from "@bluechip/domain/assistant/Card"
import type { AgentId, ConversationId, RunId } from "@bluechip/domain/Ids"
import { useAtomSet } from "@effect/atom-react/Hooks"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import { useEffect, useRef, useState } from "react"
import { cancelRunAtom, loadThreadAtom, runAtom, startConversationAtom } from "../atoms/assistant.ts"
import {
  applyEvent,
  type BluechipTurn,
  emptyTurn,
  entriesOf,
  type Entry,
  replaceCard,
  resumeEntries
} from "../model/thread.ts"

export interface AssistantState {
  /** `null` until the first message starts a conversation. */
  readonly conversationId: ConversationId | null
  /** The agent the conversation is about, if any. */
  readonly agentId: AgentId | null
  readonly load: "loading" | "ready" | "failed"
  readonly entries: ReadonlyArray<Entry>
  /** The run streaming now. */
  readonly runId: string | null
  /** A run's connection dropped: the thread is read again once back online, to show the round as the server kept it. */
  readonly dropped: boolean
}

const COULD_NOT_START = "The assistant couldn't start just now. Try again in a moment."
const CONNECTION_LOST = "The connection dropped before the answer finished. Try again, or carry on."

const fresh = (conversationId: ConversationId | null, agentId: AgentId | null): AssistantState => ({
  conversationId,
  agentId: conversationId === null ? agentId : null,
  load: conversationId === null ? "ready" : "loading",
  entries: [],
  runId: null,
  dropped: false
})

const updateLastTurn = (state: AssistantState, update: (turn: BluechipTurn) => BluechipTurn): AssistantState => {
  const last = state.entries.at(-1)
  if (last?._tag !== "Bluechip") return state
  return { ...state, entries: [...state.entries.slice(0, -1), update(last)] }
}

/**
 * A conversation with the assistant: its thread (loaded when it opens), then each message you send streamed over
 * AG-UI as tool rows, text and cards. `conversationId` follows the page: a new one starts a conversation (about
 * `agentId`, when set) on the first message, and the page's address then names it.
 */
export function useAssistant(
  { conversationId, agentId, onStarted }: Readonly<{
    conversationId: ConversationId | null
    agentId: AgentId | null
    /** The first message started a conversation. */
    onStarted: (id: ConversationId) => void
  }>
) {
  const loadThread = useAtomSet(loadThreadAtom, { mode: "promise" })
  const start = useAtomSet(startConversationAtom, { mode: "promise" })
  const run = useAtomSet(runAtom, { mode: "promise" })
  const cancelRun = useAtomSet(cancelRunAtom, { mode: "promise" })
  const [state, setState] = useState(() => fresh(conversationId, agentId))
  const [followed, setFollowed] = useState(`${conversationId} ${agentId}`)
  const lastText = useRef<string | null>(null)

  // Another conversation was picked (or a new one): start over, unless it's the one this hook just started.
  if (followed !== `${conversationId} ${agentId}`) {
    setFollowed(`${conversationId} ${agentId}`)
    if (conversationId !== state.conversationId || conversationId === null) setState(fresh(conversationId, agentId))
  }

  useEffect(() => {
    if (state.load !== "loading" || state.conversationId === null) return
    const id = state.conversationId
    let current = true
    loadThread(id).then(
      (thread) => {
        if (current) {
          setState((now) =>
            now.conversationId === id ?
              {
                ...now,
                load: "ready",
                agentId: thread.conversation.agentId,
                entries: entriesOf(thread.messages)
              } :
              now
          )
        }
      },
      () => {
        if (current) setState((now) => now.conversationId === id ? { ...now, load: "failed" } : now)
      }
    )
    return () => {
      current = false
    }
  }, [state.load, state.conversationId, loadThread])

  // bluechip keeps a round cut off by a dropped connection; read it once the connection is back (or the tab shown
  // again), and keep trying on those signals until the stored thread has the answer.
  useEffect(() => {
    if (!state.dropped || state.conversationId === null) return
    const id = state.conversationId
    let current = true
    const resync = () => {
      if (!navigator.onLine || document.visibilityState === "hidden") return
      loadThread(id).then(
        (thread) => {
          if (!current) return
          setState((now) => {
            if (now.conversationId !== id || now.runId !== null) return now
            const entries = resumeEntries(now.entries, entriesOf(thread.messages))
            return { ...now, entries, dropped: entries === now.entries }
          })
        },
        // Still unreachable: the next online or visibility signal tries again.
        () => undefined
      )
    }
    resync()
    window.addEventListener("online", resync)
    document.addEventListener("visibilitychange", resync)
    return () => {
      current = false
      window.removeEventListener("online", resync)
      document.removeEventListener("visibilitychange", resync)
    }
  }, [state.dropped, state.conversationId, loadThread])

  const send = async (text: string) => {
    if (state.runId !== null) return
    lastText.current = text
    const runId = crypto.randomUUID()
    const turnId = `turn-${runId}`
    setState((now) => ({
      ...now,
      runId,
      dropped: false,
      entries: [...now.entries, { _tag: "You", id: `you-${runId}`, text }, emptyTurn(turnId)]
    }))
    const fail = (message: string) =>
      setState((now) => ({
        ...updateLastTurn(now, (turn) => applyEvent(turn, { type: "RUN_ERROR", message })),
        runId: null,
        dropped: message === CONNECTION_LOST
      }))

    let threadId = state.conversationId
    if (threadId === null) {
      try {
        threadId = (await start({ payload: { agentId: state.agentId } })).id
      } catch {
        return fail(COULD_NOT_START)
      }
      const started = threadId
      setState((now) => ({ ...now, conversationId: started }))
      onStarted(started)
    }

    let opened = false
    let ended = false
    const input: AgUiSchema.RunAgentInput = {
      threadId,
      runId,
      messages: [{ id: `you-${runId}`, role: "user", content: text }],
      tools: [],
      context: []
    }
    try {
      await run({
        input,
        onEvent: (event) => {
          opened = true
          if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") ended = true
          setState((now) => updateLastTurn(now, (turn) => applyEvent(turn, event)))
        }
      })
      if (!ended) return fail(CONNECTION_LOST)
      setState((now) => ({ ...now, runId: null }))
    } catch {
      if (ended) setState((now) => ({ ...now, runId: null }))
      else fail(opened ? CONNECTION_LOST : COULD_NOT_START)
    }
  }

  const cancel = () => {
    if (state.runId === null) return
    // The server stops the round and ends the stream with a cancelled outcome. A cancel that fails found the run
    // already over (its stream ends on its own), so there's nothing to tell.
    cancelRun({ params: { id: state.runId as RunId } }).catch(() => undefined)
  }

  const retry = () => {
    if (lastText.current !== null) void send(lastText.current)
  }

  const updateCard = (card: Card) => setState((now) => ({ ...now, entries: replaceCard(now.entries, card) }))

  const reload = () => setState((now) => ({ ...now, load: "loading" }))

  return { state, running: state.runId !== null, send, cancel, retry, updateCard, reload }
}
