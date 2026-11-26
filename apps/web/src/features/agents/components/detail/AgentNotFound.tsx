import { ButtonLink } from "@bluechip/ui/components/button"
import { Link } from "@tanstack/react-router"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../../components/layout/AppPage.tsx"

/** An agent id that is malformed, or that no agent of this account has. */
export function AgentNotFound() {
  return (
    <AppPage title="Agent not found">
      <IllustratedEmpty
        illustration="magnifier"
        size={120}
        title="We can't find that agent"
        action={<ButtonLink variant="secondary" render={<Link to="/agents" />}>See your agents</ButtonLink>}
      >
        It may belong to another account, or the link is wrong.
      </IllustratedEmpty>
    </AppPage>
  )
}
