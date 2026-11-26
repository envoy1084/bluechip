import { AppPage } from "../../../components/layout/AppPage.tsx"
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
    </AppPage>
  )
}
