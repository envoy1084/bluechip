import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { Link } from "@tanstack/react-router"
import { AppPage } from "../../../../components/layout/AppPage.tsx"

/** An agent id that is malformed, or that no agent of this account has. */
export function AgentNotFound() {
  return (
    <AppPage title="Agent not found">
      <Empty>
        <EmptyTitle>We can't find that agent</EmptyTitle>
        <EmptyDescription>It may belong to another account, or the link is wrong.</EmptyDescription>
        <EmptyContent>
          <Button variant="secondary" nativeButton={false} render={<Link to="/agents" />}>See your agents</Button>
        </EmptyContent>
      </Empty>
    </AppPage>
  )
}
