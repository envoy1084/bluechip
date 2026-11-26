import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SidebarAgents, SidebarPauseAll } from "../features/agents/components/SidebarAgents.tsx"
import { CashDialogs } from "../features/funding/components/CashDialogs.tsx"
import { ApprovalsBell } from "../features/intents/components/approvals/ApprovalsSheet.tsx"
import { useApprovalCount } from "../features/intents/hooks/useApprovalCount.ts"
import { NotificationBell } from "../features/notifications/components/NotificationBell.tsx"
import { AppLayout } from "../features/shell/screens/AppLayout.tsx"
import { useDetectTimeZone } from "../hooks/useDetectTimeZone.ts"

// Signed-in pages render in the browser: they need the session cookie and the live stream. `sheet=approvals` opens
// the approvals sheet on any of them: where notifications and pushes about an approval lead.
export const Route = createFileRoute("/_app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { sheet?: "approvals" } =>
    search["sheet"] === "approvals" ? { sheet: "approvals" } : {},
  component: AppRoute
})

function AppRoute() {
  const approvals = useApprovalCount()
  const { sheet } = Route.useSearch()
  // Not the layout's own navigate: that one starts from its path ("/"), and the sheet opens on the page you're on.
  const navigate = useNavigate()
  const setSheet = (open: boolean) =>
    void navigate({
      to: ".",
      search: ({ sheet: _closed, ...current }) => (open ? { ...current, sheet: "approvals" as const } : current),
      replace: true
    })
  useDetectTimeZone()

  return (
    <AppLayout
      approvals={approvals}
      agents={<SidebarAgents />}
      pauseAll={<SidebarPauseAll />}
      dialogs={<CashDialogs />}
      topBar={
        <>
          <ApprovalsBell open={sheet === "approvals"} onOpenChange={setSheet} />
          <NotificationBell onReview={() => setSheet(true)} />
        </>
      }
    />
  )
}
