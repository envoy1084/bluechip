import { createFileRoute } from "@tanstack/react-router"
import { HomeScreen } from "../../features/home/screens/HomeScreen.tsx"
import { ApprovalsBell } from "../../features/intents/components/approvals/ApprovalsSheet.tsx"

export const Route = createFileRoute("/_app/home")({ component: HomePage })

function HomePage() {
  return <HomeScreen approvals={<ApprovalsBell />} />
}
