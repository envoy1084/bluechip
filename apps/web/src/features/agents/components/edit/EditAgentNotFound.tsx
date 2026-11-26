import { ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { Link } from "@tanstack/react-router"
import { AppPage } from "../../../../components/layout/AppPage.tsx"

/** Editing an agent id that is malformed, or that no agent of this account has. */
export function EditAgentNotFound() {
  return (
    <AppPage title="Edit rules">
      <Empty>
        <EmptyTitle>We don't have that agent</EmptyTitle>
        <EmptyDescription>Check the link, or pick one from your agents.</EmptyDescription>
        <ButtonLink variant="secondary" render={<Link to="/agents" />}>See your agents</ButtonLink>
      </Empty>
    </AppPage>
  )
}
