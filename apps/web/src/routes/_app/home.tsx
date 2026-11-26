import { createFileRoute } from "@tanstack/react-router"
import { LatestActivity } from "../../features/home/components/LatestActivity.tsx"
import { HomeScreen } from "../../features/home/screens/HomeScreen.tsx"
import { ApprovalsBell } from "../../features/intents/components/approvals/ApprovalsSheet.tsx"

export const Route = createFileRoute("/_app/home")({
  // `sheet=approvals` opens the approvals sheet: where notifications and pushes about an approval lead.
  validateSearch: (search: Record<string, unknown>): { sheet?: "approvals" } =>
    search["sheet"] === "approvals" ? { sheet: "approvals" } : {},
  component: HomePage
})

function HomePage() {
  const { sheet } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <HomeScreen
      approvals={
        <ApprovalsBell
          open={sheet === "approvals"}
          onOpenChange={(open) => void navigate({ search: open ? { sheet: "approvals" } : {}, replace: true })}
        />
      }
      latest={<LatestActivity />}
    />
  )
}
