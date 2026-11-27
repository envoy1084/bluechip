import { useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import { approvalsAtom } from "../../atoms/approvals.ts"
import { HomeAgents } from "../../features/agents/components/home/HomeAgents.tsx"
import { useListedAutomations } from "../../features/automations/hooks/useListedAutomations.ts"
import { HomeScreen } from "../../features/home/screens/HomeScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/home")({ head: () => pageHead({ title: "Home" }), component: HomePage })

function HomePage() {
  const navigate = Route.useNavigate()

  return (
    <HomeScreen
      approvals={useAtomValue(approvalsAtom)}
      automations={useListedAutomations("all").listed}
      agents={<HomeAgents />}
      // The frame's approvals sheet, which the address holds open.
      onReviewApprovals={() => void navigate({ search: { sheet: "approvals" }, replace: true })}
    />
  )
}
