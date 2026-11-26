import type { Device } from "@bluechip/domain/Account"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { SettingsRow, SettingsSection } from "../../../components/layout/SettingsSection.tsx"
import { securityReactivityKey } from "../../../lib/api/client.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { devicesAtom, signOutDeviceAtom, signOutOthersAtom } from "../atoms/security.ts"
import { deviceDescription } from "../model/securityText.ts"

const isPhone = (device: Device) => /iPhone|Android|iPad/.test(device.device)

/** The browsers signed in to the account: sign out one you don't know, or every one but this. */
export function DevicesCard() {
  const devices = useAtomValue(devicesAtom)
  const signOut = useAtomSet(signOutDeviceAtom, { mode: "promise" })
  const signOutOthers = useAtomSet(signOutOthersAtom, { mode: "promise" })
  const [busy, setBusy] = useState<string | undefined>(undefined)

  const list = AsyncResult.isSuccess(devices) ? devices.value : []
  const others = list.filter((device) => !device.current).length
  const timeZone = localTimeZone()

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id)
    await action().finally(() => setBusy(undefined))
  }

  return (
    <SettingsSection
      title="Devices"
      illustration="devices"
      description="Every browser signed in to your account. Sign out one you don't know."
    >
      {list.map((device) => (
        <SettingsRow
          key={device.id}
          icon={isPhone(device) ? "phone" : "desktop"}
          title={
            <>
              {device.device}
              {device.current ?
                (
                  <span className="rounded-full bg-g-100 px-2 py-0.5 text-[11.5px] font-semibold text-g-600">
                    This device
                  </span>
                ) :
                null}
            </>
          }
          description={deviceDescription(device, timeZone)}
        >
          {device.current ?
            null :
            (
              <Button
                variant="ghost"
                size="sm"
                loading={busy === device.id}
                onClick={() => void run(device.id, () => signOut(device.id))}
              >
                Sign out
              </Button>
            )}
        </SettingsRow>
      ))}
      {others > 0 ?
        (
          <SettingsRow title="Sign out everywhere else" description="Keeps this device signed in.">
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "others"}
              onClick={() => void run("others", () => signOutOthers({ reactivityKeys: [securityReactivityKey] }))}
            >
              <Icon name="logout" size={14} />Sign out others
            </Button>
          </SettingsRow>
        ) :
        null}
    </SettingsSection>
  )
}
