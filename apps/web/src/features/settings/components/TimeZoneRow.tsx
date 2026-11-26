import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { setTimeZoneAtom } from "../../../atoms/account.ts"
import { ZoneField } from "../../../components/fields/ZoneField.tsx"
import { SettingsRow as Row } from "../../../components/layout/SettingsSection.tsx"
import { accountReactivityKey } from "../../../lib/api/client.ts"
import { localTimeZone } from "../../../lib/localTime.ts"

/** Your time zone: quiet hours and the daily digest's 08:00 are in it. Set from this browser on your first visit. */
export function TimeZoneRow({ saved }: Readonly<{ saved: string | null }>) {
  const setTimeZone = useAtomSet(setTimeZoneAtom, { mode: "promise" })
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const save = async (timeZone: string | null) => {
    if (timeZone === null || timeZone === saved) return
    setSaving(true)
    setFailed(false)
    await setTimeZone({ payload: { timeZone }, reactivityKeys: [accountReactivityKey] })
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  return (
    <Row
      title="Time zone"
      description={failed ?
        "We couldn't save that time zone. Try again." :
        "Quiet hours and the daily digest at 08:00 follow it."}
    >
      <ZoneField
        label="Time zone"
        labelHidden
        choices="every"
        value={saved ?? "UTC"}
        zone={localTimeZone()}
        disabled={saving}
        onChange={(zone) => void save(zone)}
      />
    </Row>
  )
}
