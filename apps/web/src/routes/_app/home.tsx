import { useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import { HomeAgents } from "../../features/agents/components/home/HomeAgents.tsx"
import { useListedAutomations } from "../../features/automations/hooks/useListedAutomations.ts"
import { HomeScreen } from "../../features/home/screens/HomeScreen.tsx"
import { approvalsAtom } from "../../features/intents/atoms/intents.ts"
import { ApprovalsBell } from "../../features/intents/components/approvals/ApprovalsSheet.tsx"
import { useAwaitingByAgent } from "../../features/intents/hooks/useAwaitingByAgent.ts"

export const Route = createFileRoute("/_app/home")({
  // `sheet=approvals` opens the approvals sheet: where notifications and pushes about an approval lead.
  validateSearch: (search: Record<string, unknown>): { sheet?: "approvals" } =>
    search["sheet"] === "approvals" ? { sheet: "approvals" } : {},
  component: HomePage
})

function HomePage() {
  const { sheet } = Route.useSearch()
  const navigate = Route.useNavigate()
  const setSheet = (open: boolean) => void navigate({ search: open ? { sheet: "approvals" } : {}, replace: true })

  return (
    <HomeScreen
      bell={<ApprovalsBell open={sheet === "approvals"} onOpenChange={setSheet} />}
      approvals={useAtomValue(approvalsAtom)}
      automations={useListedAutomations("all").listed}
      agents={<HomeAgents awaiting={useAwaitingByAgent()} />}
      onReviewApprovals={() => setSheet(true)}
    />
  )
}
