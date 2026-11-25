import { isSpent } from "@bluechip/domain/assistant/Budget"
import type { AgentId, ConversationId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { ChatComposer } from "@bluechip/ui/bluechip/chat-composer"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { budgetAtom } from "../atoms/assistant.ts"
import { useAssistant } from "../hooks/useAssistant.ts"
import type { CardViews } from "./cards/CardViews.ts"
import { Thread } from "./Thread.tsx"

const SUGGESTIONS = ["What did my agents do today?", "How did I do this week?", "Create an agent that only rebalances"]

const AGENT_SUGGESTIONS = ["What has this agent done this week?", "Why was its last trade blocked?", "Pause this agent"]

/** The agent a conversation is about, by name. */
function Focus({ agentId }: Readonly<{ agentId: AgentId }>) {
  const agents = useAtomValue(agentsAtom)
  const agent = AsyncResult.isSuccess(agents) ? agents.value.find((each) => each.id === agentId) : undefined
  if (agent === undefined) return null

  return (
    <span className="inline-flex items-center gap-2 justify-self-start rounded-full bg-white py-1 pr-3 pl-1 text-label-sm text-g-600 shadow-e1">
      <AgentAvatar agentId={agent.id} size="sm" />
      About {agent.name}
    </span>
  )
}

/**
 * Home's conversation with the assistant: the thread, then the composer with suggestions, and a notice once the day's
 * budget is spent. `empty` is what home shows before the first message (the latest activity).
 */
export function Conversation(
  { conversationId, agentId, onStarted, empty, Trade }: Readonly<{
    conversationId: ConversationId | null
    agentId: AgentId | null
    onStarted: (id: ConversationId) => void
    empty?: ReactNode
    Trade: CardViews["Trade"]
  }>
) {
  const { state, running, send, cancel, retry, updateCard, reload } = useAssistant({
    conversationId,
    agentId,
    onStarted
  })
  const budget = useAtomValue(budgetAtom)
  const { nameOf } = useStockLookup()
  const spent = AsyncResult.isSuccess(budget) && isSpent(budget.value)

  return (
    <div className="grid gap-[18px]">
      {state.agentId === null ? null : <Focus agentId={state.agentId} />}

      {state.load === "loading" ?
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="ml-auto h-10 w-64 rounded-[16px]" />
            <SkeletonBlock className="h-24 w-full rounded-lg" />
          </div>
        ) :
        state.load === "failed" ?
        (
          <div className="grid justify-items-center gap-3 py-8 text-center">
            <p className="text-body-sm text-g-600">
              We couldn't load this conversation. Check your connection and try again.
            </p>
            <Button variant="secondary" onClick={reload}>Try again</Button>
          </div>
        ) :
        state.entries.length === 0 ?
        empty :
        <Thread entries={state.entries} onCard={updateCard} onRetry={retry} Trade={Trade} nameOf={nameOf} />}

      <div className="sticky bottom-0 z-[5] -mx-1 grid gap-2.5 bg-[linear-gradient(180deg,transparent,var(--color-canvas)_18px)] px-1 pt-5 pb-3">
        {spent ?
          (
            <Alert>
              <AlertDescription>
                You've used today's assistant budget. It resets at midnight UTC, and everything else in bluechip still
                works.
              </AlertDescription>
            </Alert>
          ) :
          null}
        <ChatComposer
          onSend={(text) => void send(text)}
          sending={running}
          onStop={cancel}
          suggestions={state.entries.length === 0 && state.load === "ready" ?
            (state.agentId === null ? SUGGESTIONS : AGENT_SUGGESTIONS) :
            []}
        />
      </div>
    </div>
  )
}
