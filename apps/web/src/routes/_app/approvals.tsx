import { createFileRoute } from "@tanstack/react-router"
import { ApprovalsList, useApprovalCount } from "../../intents/ApprovalsList.tsx"
import { waitingText } from "../../intents/ApprovalsSheet.tsx"
import { AppPage } from "../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/approvals")({ component: ApprovalsPage })

/** Agents' trades over their largest trade, waiting for your Face ID. */
function ApprovalsPage() {
  const count = useApprovalCount()

  return (
    <AppPage title="Approvals" sub={waitingText(count)}>
      <section aria-labelledby="waiting-for-you" className="grid gap-2.5">
        <h2 id="waiting-for-you" className="px-0.5 text-label-sm font-semibold text-g-500">Waiting for you</h2>
        <ApprovalsList />
      </section>
    </AppPage>
  )
}
