import { isSpent } from "@bluechip/domain/assistant/Budget"
import type { AgentId } from "@bluechip/domain/Ids"
import { ChatComposer } from "@bluechip/ui/bluechip/chat-composer"
import { ChatConversation, ChatConversationContent, ChatScrollButton } from "@bluechip/ui/bluechip/chat-conversation"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useCallback } from "react"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { useNow } from "../../../hooks/useNow.ts"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { dailyResetText } from "../../../lib/localTime.ts"
import { budgetAtom } from "../atoms/assistant.ts"
import type { useAssistant } from "../hooks/useAssistant.ts"
import { AgentPicker } from "./AgentPicker.tsx"
import type { CardViews } from "./cards/CardViews.ts"
import { ChatStartHeading, useStartIdeas } from "./ChatStart.tsx"
import { Thread } from "./Thread.tsx"

/** The column's width: one readable measure, centred. */
const COLUMN = "mx-auto w-full max-w-[720px] px-4 md:px-6"

/**
 * One conversation in the chat page's centre column: the thread, which follows a streaming answer to the bottom,
 * then the composer with who the trades go through, the suggestions and a notice once the day's budget is spent.
 */
export function Conversation(
  { assistant, initialMessage, Trade }: Readonly<{
    assistant: ReturnType<typeof useAssistant>
    /** Put in the box to edit or send, as when a suggestion elsewhere led here. */
    initialMessage?: string | undefined
    Trade: CardViews["Trade"]
  }>
) {
  const now = useNow(60_000)
  const { state, running, send, cancel, retry, updateCard, reload, chooseAgent } = assistant
  const budget = useAtomValue(budgetAtom)
  const { nameOf } = useStockLookup()
  const spent = AsyncResult.isSuccess(budget) && isSpent(budget.value)
  const fresh = state.entries.length === 0 && state.load === "ready"
  const ideas = useStartIdeas(state.agentId)

  // Opening a conversation puts you in its box (keyed below, so it mounts again), as does the start screen turning
  // into the thread. Only where there is a mouse or trackpad: on touch screens it would pop the keyboard up.
  const focusOnOpen = useCallback((area: HTMLDivElement | null) => {
    if (area === null || !window.matchMedia("(pointer: fine)").matches) return
    area.querySelector("textarea")?.focus({ preventScroll: true })
  }, [])

  const composer = (
    <div key={`${state.conversationId} ${initialMessage}`} ref={focusOnOpen}>
      <ChatComposer
        defaultMessage={initialMessage}
        onSend={(text) => void send(text)}
        sending={running}
        onStop={cancel}
        size="lg"
        leading={
          <AgentPicker
            agentId={state.agentId}
            onChange={(agentId: AgentId | null) => chooseAgent(agentId)}
            locked={state.conversationId !== null}
          />
        }
      />
    </div>
  )
  const budgetNotice = spent ?
    (
      <Alert>
        <AlertDescription>
          You've used today's assistant budget. It resets at{" "}
          {dailyResetText(now)}, and everything else in bluechip still works.
        </AlertDescription>
      </Alert>
    ) :
    null

  // Before the first message the page is a start screen: the prompt in the middle, ideas under it. The first message
  // turns it into the thread, with the box at the bottom.
  if (fresh) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className={`${COLUMN} my-auto grid gap-6 py-10`}>
          <div className="grid justify-items-center gap-2 text-center">
            <Illustration name="chat" variant="halftone" size={132} animate className="-mb-1" />
            <ChatStartHeading agentId={state.agentId} />
          </div>
          {budgetNotice}
          {composer}
          <ul aria-label="Ideas to start with" className="grid gap-2.5 sm:grid-cols-2">
            {ideas.map((idea) => (
              <li key={idea.ask}>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void send(idea.ask)}
                  className="group/idea flex h-full w-full cursor-pointer items-start gap-3 rounded-[14px] bg-white p-3.5 text-left shadow-e1 transition-[box-shadow,transform] duration-fast ease-brand hover:-translate-y-px hover:shadow-e2 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-blue-50 text-blue">
                    <Icon name={idea.icon} size={16} />
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <b className="text-[14px] font-semibold group-hover/idea:text-blue">{idea.ask}</b>
                    <span className="text-label-sm text-g-500">{idea.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

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
            <LoadProblem what="this conversation" onRetry={reload} size="sm" /> :
            state.entries.length === 0 ?
            <ChatStartHeading agentId={state.agentId} /> :
            <Thread entries={state.entries} onCard={updateCard} onRetry={retry} Trade={Trade} nameOf={nameOf} />}
        </ChatConversationContent>
        <ChatScrollButton />
      </ChatConversation>

      <div className={`${COLUMN} grid gap-2.5 pb-4`}>
        {budgetNotice}
        {composer}
      </div>
    </div>
  )
}
