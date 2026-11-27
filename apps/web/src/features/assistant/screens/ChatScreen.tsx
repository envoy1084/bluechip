import type { AgentId, ConversationId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { LogoMark } from "@bluechip/ui/bluechip/logo"
import { Button } from "@bluechip/ui/components/button"
import { SidebarProvider, SidebarTrigger, useSidebar } from "@bluechip/ui/components/sidebar"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type CSSProperties, type ReactNode, useEffect } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { ConnectionBanner } from "../../../components/layout/ConnectionBanner.tsx"
import { useFrameActions } from "../../../components/layout/FrameActions.tsx"
import { previousPage, track } from "../../../lib/analytics.ts"
import { conversationsAtom } from "../atoms/assistant.ts"
import type { CardViews } from "../components/cards/CardViews.ts"
import { Conversation } from "../components/Conversation.tsx"
import { ThreadsSidebar } from "../components/ThreadsSidebar.tsx"
import { useAssistant } from "../hooks/useAssistant.ts"

/** The conversation's name in the header: its title once it has one, its agent beside it. */
function ChatTitle({ conversationId }: Readonly<{ conversationId: ConversationId | null }>) {
  const conversations = useAtomValue(conversationsAtom)
  const title = conversationId === null || !AsyncResult.isSuccess(conversations) ?
    null :
    conversations.value.items.find((conversation) => conversation.id === conversationId)?.title ?? null

  return <h1 className="truncate text-[17px] leading-tight font-semibold tracking-[-0.02em]">{title ?? "New chat"}</h1>
}

/** The agent the chat's trades go through, at the header's far end. */
function ChatAgent({ agentId }: Readonly<{ agentId: AgentId | null }>) {
  const agents = useAtomValue(agentsAtom)
  const agent = agentId === null || !AsyncResult.isSuccess(agents) ?
    undefined :
    agents.value.find((each) => each.id === agentId)
  if (agent === undefined) return null

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue/10 py-0.5 pr-2.5 pl-0.5 text-label-sm font-medium text-blue">
      <AgentAvatar agentId={agent.id} size="sm" className="size-5" />
      {agent.name}
    </span>
  )
}

/**
 * The chat page: the app's sidebar, then a second, collapsible one with every conversation, then one conversation in
 * a centred column. `approvals` is the approvals bell and `Trade` the live trade view, both from the intents feature.
 */
export function ChatScreen(
  { conversationId, agentId, initialMessage, onStarted, approvals, Trade }: Readonly<{
    conversationId: ConversationId | null
    /** A new conversation starts about this agent (the picker can change it before the first message). */
    agentId: AgentId | null
    initialMessage?: string | undefined
    onStarted: (id: ConversationId) => void
    approvals: ReactNode
    Trade: CardViews["Trade"]
  }>
) {
  const app = useSidebar()
  // Where the chat was opened from: an agent's page, home's question box, or the sidebar and every other way in.
  const entry = agentId !== null ? "agent_page" : initialMessage !== undefined || previousPage() === "/home" ?
    "home_ask" :
    "sidebar"
  useEffect(() => track({ _tag: "assistant_opened", entry }), [entry])
  const assistant = useAssistant({ conversationId, agentId, onStarted })
  const frameActions = useFrameActions()

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <SidebarProvider
        className="min-h-0 flex-1"
        shortcut={false}
        storageKey="bluechip:chats"
        style={{ "--sidebar-width": "288px" } as CSSProperties}
      >
        <ThreadsSidebar current={assistant.state.conversationId} />
        <div className="flex h-svh min-w-0 flex-1 flex-col [view-transition-name:page]">
          <header className="flex min-h-[60px] shrink-0 items-center justify-between gap-3 border-b border-ink/6 bg-canvas/90 px-4 py-2.5 backdrop-blur md:px-5">
            <div className="flex min-w-0 items-center gap-1.5">
              {/* The app's own sidebar is a level up, so its trigger is drawn from its state, not this provider's. */}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Toggle sidebar"
                aria-expanded={app.isMobile ? app.openMobile : app.open}
                onClick={app.toggleSidebar}
                className="-ml-1.5"
              >
                <Icon name="sidebar" size={18} />
              </Button>
              <LogoMark className="md:hidden" />
              <SidebarTrigger label="Toggle chats" className="text-g-500">
                <Icon name="chat" size={18} />
              </SidebarTrigger>
              <ChatTitle conversationId={assistant.state.conversationId} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ChatAgent agentId={assistant.state.agentId} />
              {approvals}
              {frameActions}
            </div>
          </header>
          <div className="px-4 pt-3 empty:hidden md:px-6">
            <ConnectionBanner />
          </div>
          <Conversation
            assistant={assistant}
            initialMessage={initialMessage}
            Trade={Trade}
          />
        </div>
      </SidebarProvider>
    </div>
  )
}
