import { Button } from "@bluechip/ui/components/button"
import { Switch } from "@bluechip/ui/components/switch"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { pushKeys, unsubscribePushAtom } from "../../atoms/notifications.ts"
import { type PushState, usePushDevice } from "../../hooks/usePushDevice.ts"
import { SettingsCard, SettingsRow } from "./SettingsCard.tsx"

const SAID: Readonly<Record<PushState, string>> = {
  loading: "Checking this browser.",
  unsupported: "This browser can't show push notifications. On iPhone, add bluechip to your Home Screen first.",
  unavailable: "Push isn't set up on this bluechip server yet.",
  blocked: "Notifications are blocked for bluechip. Allow them in your browser's site settings, then come back.",
  off: "Off on this device. Turn it on to get what you choose below as notifications here.",
  on: "On: this device gets what you choose below, even with bluechip closed."
}

/** Push, device by device: this browser's opt-in, and the other devices that opted in. */
export function PushCard() {
  const push = usePushDevice()
  const remove = useAtomSet(unsubscribePushAtom, { mode: "promise" })

  return (
    <SettingsCard title="Push notifications" description="Each device opts in on its own.">
      <SettingsRow
        title="This device"
        description={push.failed ? "That didn't work. Nothing changed, so try again." : SAID[push.state]}
      >
        <Switch
          checked={push.state === "on"}
          disabled={push.busy || (push.state !== "on" && push.state !== "off")}
          aria-label="Push on this device"
          onCheckedChange={(on) => on ? push.turnOn() : push.turnOff()}
        />
      </SettingsRow>
      {push.others.map((device) => (
        <SettingsRow key={device.id} title={device.device} description="Gets push notifications.">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              remove({ params: { id: device.id }, reactivityKeys: pushKeys })}
          >
            Remove
          </Button>
        </SettingsRow>
      ))}
    </SettingsCard>
  )
}
