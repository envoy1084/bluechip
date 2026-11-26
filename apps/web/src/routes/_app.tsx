import { createFileRoute } from "@tanstack/react-router"
import { SidebarAgents, SidebarPauseAll } from "../features/agents/components/SidebarAgents.tsx"
import { CashDialogs } from "../features/funding/components/CashDialogs.tsx"
import { useApprovalCount } from "../features/intents/hooks/useApprovalCount.ts"
import { NotificationBell } from "../features/notifications/components/NotificationBell.tsx"
import { AppLayout } from "../features/shell/screens/AppLayout.tsx"
import { useDetectTimeZone } from "../hooks/useDetectTimeZone.ts"

// Signed-in pages render in the browser: they need the session cookie and the live stream.
export const Route = createFileRoute("/_app")({ ssr: false, component: AppRoute })

function AppRoute() {
  const approvals = useApprovalCount()
  useDetectTimeZone()

  return (
    <AppLayout
      approvals={approvals}
      agents={<SidebarAgents />}
      pauseAll={<SidebarPauseAll />}
      dialogs={<CashDialogs />}
      topBar={<NotificationBell />}
    />
  )
}
