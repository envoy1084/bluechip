import { ButtonLink } from "@bluechip/ui/components/button"
import { Link } from "@tanstack/react-router"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../../components/layout/AppPage.tsx"

/** Editing an agent id that is malformed, or that no agent of this account has. */
export function EditAgentNotFound() {
  return (
    <AppPage title="Edit rules">
      <IllustratedEmpty
        illustration="magnifier"
        size={120}
        title="We don't have that agent"
        action={<ButtonLink variant="secondary" render={<Link to="/agents" />}>See your agents</ButtonLink>}
      >
        Check the link, or pick one from your agents.
      </IllustratedEmpty>
    </AppPage>
  )
}
