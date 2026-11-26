import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { meAtom } from "../../../atoms/account.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { notificationSettingsAtom } from "../atoms/notifications.ts"
import { KindRules } from "../components/settings/KindRules.tsx"
import { PushCard } from "../components/settings/PushCard.tsx"
import { QuietHoursCard } from "../components/settings/QuietHoursCard.tsx"
import { TelegramCard } from "../components/settings/TelegramCard.tsx"

/** Where each kind of notification goes (the app, push, Telegram), quiet hours, this device's push and Telegram. */
export function NotificationSettingsScreen() {
  const settings = useAtomValue(notificationSettingsAtom)
  const me = useAtomValue(meAtom)

  return (
    <AppPage
      title="Notifications"
      actions={
        <ButtonLink variant="ghost" size="sm" render={<Link to="/settings" />}>
          <Icon name="arrow-left" size={14} />Settings
        </ButtonLink>
      }
    >
      <TelegramCard />
      <PushCard />
      {AsyncResult.isSuccess(settings) ?
        (
          <>
            <QuietHoursCard
              quietHours={settings.value.quietHours}
              timeZone={AsyncResult.isSuccess(me) ? me.value.user.timeZone : null}
            />
            <KindRules rules={settings.value.rules} />
          </>
        ) :
        null}
    </AppPage>
  )
}
