import { isSpent } from "@bluechip/domain/assistant/Budget"
import type { AgentId } from "@bluechip/domain/Ids"
import { ChatComposer } from "@bluechip/ui/bluechip/chat-composer"
import { ChatConversation, ChatConversationContent, ChatScrollButton } from "@bluechip/ui/bluechip/chat-conversation"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { budgetAtom } from "../atoms/assistant.ts"
import type { useAssistant } from "../hooks/useAssistant.ts"
import { AgentPicker } from "./AgentPicker.tsx"
import type { CardViews } from "./cards/CardViews.ts"
import { Thread } from "./Thread.tsx"

const SUGGESTIONS = ["What did my agents do today?", "How did I do this week?", "Create an agent that only rebalances"]

const AGENT_SUGGESTIONS = ["What has this agent done this week?", "Sell $50 of Nvidia", "Pause this agent"]

/** The column's width: one readable measure, centred. */
const COLUMN = "mx-auto w-full max-w-[720px] px-4 md:px-6"

/**
 * One conversation in the chat page's centre column: the thread, which follows a streaming answer to the bottom,
 * then the composer with who the trades go through, the suggestions and a notice once the day's budget is spent.
 * `empty` is what shows before the first message.
 */
export function Conversation(
  { assistant, empty, initialMessage, Trade }: Readonly<{
    assistant: ReturnType<typeof useAssistant>
    empty: ReactNode
    /** Put in the box to edit or send, as when a suggestion elsewhere led here. */
    initialMessage?: string | undefined
    Trade: CardViews["Trade"]
  }>
) {
  const { state, running, send, cancel, retry, updateCard, reload, chooseAgent } = assistant
  const budget = useAtomValue(budgetAtom)
  const { nameOf } = useStockLookup()
  const spent = AsyncResult.isSuccess(budget) && isSpent(budget.value)
  const fresh = state.entries.length === 0 && state.load === "ready"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatConversation label="Messages">
        <ChatConversationContent className={`${COLUMN} grid gap-5 pt-6 pb-8`}>
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
        </ChatConversationContent>
        <ChatScrollButton />
      </ChatConversation>

      <div className={`${COLUMN} grid gap-2.5 pb-4`}>
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
          key={initialMessage}
          defaultMessage={initialMessage}
          onSend={(text) => void send(text)}
          sending={running}
          onStop={cancel}
          leading={
            <AgentPicker
              agentId={state.agentId}
              onChange={(agentId: AgentId | null) => chooseAgent(agentId)}
              locked={state.conversationId !== null}
            />
          }
          suggestions={fresh ? (state.agentId === null ? SUGGESTIONS : AGENT_SUGGESTIONS) : []}
        />
      </div>
    </div>
  )
}
