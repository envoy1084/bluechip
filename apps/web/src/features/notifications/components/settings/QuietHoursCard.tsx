import type { QuietHours } from "@bluechip/domain/notifications/Notification"
import { Switch } from "@bluechip/ui/components/switch"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { TimeField } from "../../../../components/fields/TimeField.tsx"
import { zoneLabel } from "../../../../lib/timeZones.ts"
import { notificationKeys, setQuietHoursAtom } from "../../atoms/notifications.ts"
import { SettingsCard, SettingsRow } from "./SettingsCard.tsx"

/** Quiet hours: push and Telegram wait until they end, in your time zone. Security notifications never wait. */
export function QuietHoursCard(
  { quietHours, timeZone }: Readonly<{ quietHours: QuietHours | null; timeZone: string | null }>
) {
  const setQuietHours = useAtomSet(setQuietHoursAtom, { mode: "promise" })
  const [saving, setSaving] = useState(false)
  const save = async (next: QuietHours | null) => {
    setSaving(true)
    await setQuietHours({ payload: { quietHours: next }, reactivityKeys: notificationKeys })
      .finally(() => setSaving(false))
  }
  const current = quietHours ?? { from: "22:00", to: "07:00" }

  return (
    <SettingsCard
      title="Quiet hours"
      description="Push and Telegram wait until they end. Security notifications never wait."
      illustration="moon"
    >
      <SettingsRow
        title="Quiet hours"
        description={quietHours === null ?
          "Off: everything goes out when it happens." :
          `In ${zoneLabel(timeZone ?? "UTC")} time, your time zone in Settings.`}
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
              <TimeField
                label="Quiet from"
                labelHidden
                value={quietHours.from}
                disabled={saving}
                onChange={(from) => from !== quietHours.from && void save({ ...quietHours, from })}
              />
              <span className="text-g-500">to</span>
              <TimeField
                label="Quiet until"
                labelHidden
                value={quietHours.to}
                disabled={saving}
                onChange={(to) => to !== quietHours.to && void save({ ...quietHours, to })}
              />
            </div>
          </SettingsRow>
        )}
    </SettingsCard>
  )
}
