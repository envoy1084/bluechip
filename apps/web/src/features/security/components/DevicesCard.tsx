import type { Device } from "@bluechip/domain/Account"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Button } from "@bluechip/ui/components/button"
import { toast } from "@bluechip/ui/components/toast"
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
                <StatusPill tone="info">This device</StatusPill> :
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
                aria-label={`Sign out ${device.device}`}
                loading={busy === device.id}
                onClick={() =>
                  void run(device.id, () =>
                    signOut(device.id).then(
                      () => toast.success(`${device.device} is signed out`),
                      () => toast.error(`${device.device} is still signed in`, { description: "Try again." })
                    ))}
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
