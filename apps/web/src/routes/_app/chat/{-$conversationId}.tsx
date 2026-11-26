import { AgentId, ConversationId } from "@bluechip/domain/Ids"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { ChatScreen } from "../../../features/assistant/screens/ChatScreen.tsx"
import { AgentTradeProgress } from "../../../features/intents/components/agent/AgentTradeProgress.tsx"
import { ApprovalsBell } from "../../../features/intents/components/approvals/ApprovalsSheet.tsx"

const isConversationId = Schema.is(ConversationId)
const isAgentId = Schema.is(AgentId)

// One route for a new chat (`/chat`) and an open one (`/chat/:id`): the first message moves the address to the
// conversation it started without remounting the page, so the streaming answer carries on.
export const Route = createFileRoute("/_app/chat/{-$conversationId}")({
  // `agent` starts a new chat about that agent; `ask` puts a question in the box to edit or send.
  validateSearch: (search: Record<string, unknown>): { agent?: AgentId; ask?: string } => ({
    ...(isAgentId(search["agent"]) ? { agent: search["agent"] } : {}),
    ...(typeof search["ask"] === "string" && search["ask"].trim() !== "" ? { ask: search["ask"] } : {})
  }),
  component: ChatPage
})

function ChatPage() {
  const { conversationId } = Route.useParams()
  const { agent, ask } = Route.useSearch()
  const navigate = Route.useNavigate()
  // An address that names no conversation opens a new chat.
  if (conversationId !== undefined && !isConversationId(conversationId)) {
    return <Navigate to="/chat/{-$conversationId}" params={{ conversationId: undefined }} replace />
  }

  return (
    <ChatScreen
      conversationId={conversationId ?? null}
      agentId={agent ?? null}
      initialMessage={ask}
      onStarted={(id) => void navigate({ params: { conversationId: id }, search: {}, replace: true })}
      approvals={<ApprovalsBell />}
      Trade={AgentTradeProgress}
    />
  )
}
