import type { QuietHours } from "@bluechip/domain/notifications/Notification"
import { Input } from "@bluechip/ui/components/input"
import { Switch } from "@bluechip/ui/components/switch"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { notificationKeys, setQuietHoursAtom } from "../../atoms/notifications.ts"
import { SettingsCard, SettingsRow } from "./SettingsCard.tsx"

/** Quiet hours: push and Telegram wait until they end, in your time zone. Security notifications never wait. */
export function QuietHoursCard({ quietHours }: Readonly<{ quietHours: QuietHours | null }>) {
  const setQuietHours = useAtomSet(setQuietHoursAtom, { mode: "promise" })
  const [saving, setSaving] = useState(false)
  const save = async (next: QuietHours | null) => {
    setSaving(true)
    await setQuietHours({ payload: { quietHours: next }, reactivityKeys: notificationKeys })
      .finally(() => setSaving(false))
  }
  const current = quietHours ?? { from: "22:00", to: "07:00", zone: localTimeZone() }

  return (
    <SettingsCard
      title="Quiet hours"
      description="Push and Telegram wait until they end. Security notifications never wait."
    >
      <SettingsRow
        title="Quiet hours"
        description={quietHours === null ? "Off: everything goes out when it happens." : `In ${quietHours.zone} time.`}
      >
        <Switch
          checked={quietHours !== null}
          disabled={saving}
          aria-label="Quiet hours"
          onCheckedChange={(on) => save(on ? current : null)}
        />
      </SettingsRow>
      {quietHours === null ?
        null :
        (
          <SettingsRow title="From and to" description="A window past midnight carries on into the next day.">
            <div className="flex items-center gap-2">
              <Input
                type="time"
                aria-label="Quiet from"
                className="w-[118px]"
                defaultValue={quietHours.from}
                disabled={saving}
                onBlur={(event) =>
                  event.target.value !== "" && event.target.value !== quietHours.from &&
                  save({ ...quietHours, from: event.target.value })}
              />
              <span className="text-g-500">to</span>
              <Input
                type="time"
                aria-label="Quiet until"
                className="w-[118px]"
                defaultValue={quietHours.to}
                disabled={saving}
                onBlur={(event) =>
                  event.target.value !== "" && event.target.value !== quietHours.to &&
                  save({ ...quietHours, to: event.target.value })}
              />
            </div>
          </SettingsRow>
        )}
    </SettingsCard>
  )
}
