import { AgentId, ConversationId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { Conversation } from "../../features/assistant/components/Conversation.tsx"
import { ConversationsButton } from "../../features/assistant/components/ConversationsSheet.tsx"
import { LatestActivity } from "../../features/home/components/LatestActivity.tsx"
import { HomeScreen } from "../../features/home/screens/HomeScreen.tsx"
import { AgentTradeProgress } from "../../features/intents/components/agent/AgentTradeProgress.tsx"
import { ApprovalsBell } from "../../features/intents/components/approvals/ApprovalsSheet.tsx"

const isConversationId = Schema.is(ConversationId)
const isAgentId = Schema.is(AgentId)

export const Route = createFileRoute("/_app/home")({
  // `conversation` opens one; `agent` starts a new one about that agent.
  validateSearch: (search: Record<string, unknown>): { conversation?: ConversationId; agent?: AgentId } => ({
    ...(isConversationId(search["conversation"]) ? { conversation: search["conversation"] } : {}),
    ...(isAgentId(search["agent"]) ? { agent: search["agent"] } : {})
  }),
  component: HomePage
})

function HomePage() {
  const { conversation, agent } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <HomeScreen
      approvals={<ApprovalsBell />}
      conversations={<ConversationsButton current={conversation ?? null} />}
      conversation={
        <Conversation
          conversationId={conversation ?? null}
          agentId={agent ?? null}
          onStarted={(id) => void navigate({ search: { conversation: id }, replace: true })}
          empty={<LatestActivity />}
          Trade={AgentTradeProgress}
        />
      }
    />
  )
}
