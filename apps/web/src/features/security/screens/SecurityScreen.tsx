import { ButtonLink } from "@bluechip/ui/components/button"
import { Link } from "@tanstack/react-router"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { SettingsRow, SettingsSection } from "../../../components/layout/SettingsSection.tsx"
import { DevicesCard } from "../components/DevicesCard.tsx"
import { PasskeysCard } from "../components/PasskeysCard.tsx"
import { RecoveryCard } from "../components/RecoveryCard.tsx"

/** Who can sign for the account and get back into it: its passkeys, the recovery key, and the devices signed in. */
export function SecurityScreen() {
  return (
    <AppPage title="Security">
      <PasskeysCard />
      <RecoveryCard />
      <DevicesCard />
      <SettingsSection title="Audit log" description="Everything that happened to your account, as it happened.">
        <SettingsRow
          icon="book"
          title="Audit log"
          description="Trades, agents, passkeys, sign-ins and recoveries, filtered and saved as JSON."
        >
          <ButtonLink variant="secondary" size="sm" render={<Link to="/settings/audit" />}>
            Open the audit log
          </ButtonLink>
        </SettingsRow>
      </SettingsSection>
    </AppPage>
  )
}
