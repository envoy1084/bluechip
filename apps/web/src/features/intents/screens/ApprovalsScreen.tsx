import { AppPage } from "../../../components/layout/AppPage.tsx"
import { ApprovalsList } from "../components/approvals/ApprovalsList.tsx"
import { useApprovalCount } from "../hooks/useApprovalCount.ts"
import { waitingText } from "../model/intentText.ts"

/** Agents' trades over their largest trade, waiting for your Face ID. */
export function ApprovalsScreen() {
  const count = useApprovalCount()

  return (
    <AppPage title="Approvals" sub={waitingText(count)}>
      <section aria-label="Waiting for you" className="grid gap-2.5">
        <ApprovalsList />
      </section>
    </AppPage>
  )
}
