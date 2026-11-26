import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { notificationSettingsAtom } from "../atoms/notifications.ts"
import { KindRules } from "../components/settings/KindRules.tsx"
import { QuietHoursCard } from "../components/settings/QuietHoursCard.tsx"

/** Where each kind of notification goes (the app, push, Telegram), quiet hours, this device's push and Telegram. */
export function NotificationSettingsScreen() {
  const settings = useAtomValue(notificationSettingsAtom)

  return (
    <AppPage
      title="Notifications"
      sub="What bluechip tells you, and where"
      actions={
        <ButtonLink variant="ghost" size="sm" render={<Link to="/settings" />}>
          <Icon name="arrow-left" size={14} />Settings
        </ButtonLink>
      }
    >
      {AsyncResult.isSuccess(settings) ?
        (
          <>
            <QuietHoursCard quietHours={settings.value.quietHours} />
            <KindRules rules={settings.value.rules} />
          </>
        ) :
        null}
    </AppPage>
  )
}
